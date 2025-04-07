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

import { newSimpleError, simplifyError } from "@archival/core/error";
import type { Result } from "@archival/core/result";
import type { FetchRequest } from "@archival/fetch";
import type { Queue } from "@archival/queue";
import {
	LogKey,
	LogValue,
	type SignalLogsEnv,
	structuredLoggerMiddleware,
	withProperties,
} from "@archival/signal/logs";

import { BUILD_VERSION, PACKAGE_NAME } from "signal/src/build";
import { type InspectUrlResult, inspectUrl } from "./urls";

const logKeyFetchRequest = "fetchRequest";
const logKeyFetchPushAttempts = "attempt";

const responseUnknownContentType =
	"unable to dispatch URL, unknown content type";

export type DispatchEnv = {
	Bindings: {
		FETCH_QUEUE: Queue;
	};
} & SignalLogsEnv;

export const dispatchApp = new Hono<DispatchEnv>();

dispatchApp.use("*", structuredLoggerMiddleware);
dispatchApp.post("/", dispatchPostHandler);

async function dispatchPostHandler(c: Context<DispatchEnv>) {
	const url = await c.req.text();
	const inspectResult: InspectUrlResult = inspectUrl(url);

	if (inspectResult.contentType === undefined) {
		throw new HTTPException(400, {
			cause: newSimpleError(responseUnknownContentType, {
				context: { url: url, checks: inspectResult.checks },
			}),
		});
	}

	const log = withProperties(
		{
			[LogKey.ServiceName]: PACKAGE_NAME,
			[LogKey.ServiceVersion]: BUILD_VERSION,
			[LogKey.CodeComponent]: "dispatchPostHandler",
			[LogKey.Url]: url,
		},
		c.get("logger"),
	);

	const fetchRequest: FetchRequest = {
		url: url,
		contentType: inspectResult.contentType,
	};

	let attempt: number;
	let result: Result<undefined>;
	for (attempt = 0; attempt < 5; attempt++) {
		log({
			[LogKey.SeverityText]: LogValue.SeverityTextDebug,
			[LogKey.SeverityNumber]: LogValue.SeverityNumberDebug,
			[LogKey.Message]: "sending FetchRequest to queue",
			[logKeyFetchRequest]: fetchRequest,
		});

		result = await c.env.FETCH_QUEUE.send(fetchRequest);
		if (result.err === undefined) {
			break;
		}

		if (attempt === 4) {
			log({
				[LogKey.SeverityText]: LogValue.SeverityTextFatal,
				[LogKey.SeverityNumber]: LogValue.SeverityNumberFatal,
				[LogKey.Message]: "unable to publish new fetch request to queue",
				[LogKey.Error]: simplifyError(result.err),
				[logKeyFetchRequest]: fetchRequest,
				[logKeyFetchPushAttempts]: attempt + 1,
			});

			throw new HTTPException(500, { cause: result.err });
		}

		log({
			[LogKey.SeverityText]: LogValue.SeverityTextWarn,
			[LogKey.SeverityNumber]: LogValue.SeverityNumberWarn,
			[LogKey.Message]: "error while publishing new fetch request to queue",
			[LogKey.Error]: simplifyError(result.err),
			[logKeyFetchRequest]: fetchRequest,
			[logKeyFetchPushAttempts]: attempt + 1,
		});

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	log({
		[LogKey.SeverityText]: LogValue.SeverityTextDebug,
		[LogKey.SeverityNumber]: LogValue.SeverityNumberDebug,
		[LogKey.Message]: "published new fetch request to queue",
		[logKeyFetchRequest]: fetchRequest,
		[logKeyFetchPushAttempts]: attempt + 1,
	});

	return new Response(undefined, { status: 200 });
}
