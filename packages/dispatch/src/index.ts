/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Copyright 2025, the aRchIVAL contributors.
 *
 * This file is part of aRchIVAL.
 *
 * aRchIVAL is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
 * Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * aRchIVAL is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with aRchIVAL. If not,
 * see <https://www.gnu.org/licenses/>.
 */
import { type Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type RequestIdVariables, requestId } from "hono/request-id";

import { simplifyError } from "@archival/core/error";
import {
	LogKey,
	LogValue,
	type ObservabilityLoggingVariables,
	type StructuredLoggerMiddlewareVariables,
	logWithProperties,
	structuredLoggerMiddleware,
} from "@archival/core/logging";
import type { Result } from "@archival/core/result";
import type { FetchRequest } from "@archival/fetch";
import type { Queue } from "@archival/queue";

import { type InspectUrlResult, inspectUrl } from "./urls";

const logKeyFetchRequest = "fetchRequest";
const logKeyFetchPushAttempts = "attempt";

const responseUnknownContentType =
	"unable to dispatch URL, unknown contenttype";

export type DispatchEnv = {
	Bindings: {
		FETCH_QUEUE: Queue;
	} & ObservabilityLoggingVariables;
	Variables: RequestIdVariables & StructuredLoggerMiddlewareVariables;
};

export const dispatchApp = new Hono<DispatchEnv>();

dispatchApp.use("*", requestId());
dispatchApp.use("*", structuredLoggerMiddleware);
dispatchApp.post("/", dispatchPostHandler);

async function dispatchPostHandler(c: Context<DispatchEnv>) {
	const log = logWithProperties(
		{
			[LogKey.RequestId]: c.get("requestId"),
		},
		c.get("logger"),
	);

	const url = await c.req.text();
	const inspectResult: InspectUrlResult = inspectUrl(url);

	if (inspectResult.contentType === undefined) {
		throw new HTTPException(400, { cause: responseUnknownContentType });
	}

	const fetchRequest: FetchRequest = {
		url: url,
		contentType: inspectResult.contentType,
	};

	let attempt: number;
	let result: Result<undefined>;
	for (attempt = 0; attempt < 5; attempt++) {
		result = await c.env.FETCH_QUEUE.send(fetchRequest);
		if (result.err === undefined) {
			break;
		}

		log({
			[LogKey.Error]: simplifyError(result.err),
			[LogKey.Message]: "error while publishing new fetch request to queue",
			[logKeyFetchRequest]: fetchRequest,
			[logKeyFetchPushAttempts]: attempt + 1,
		});

		if (attempt === 4) {
			throw new HTTPException(500, { cause: result.err });
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	log({
		[LogKey.Debug]: LogValue.Debug,
		[LogKey.Message]: "published new fetch request to queue",
		[logKeyFetchRequest]: fetchRequest,
		[logKeyFetchPushAttempts]: attempt + 1,
	});

	return new Response(undefined, { status: 200 });
}
