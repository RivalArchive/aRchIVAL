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
import { simplifyError } from "@archival/core/error";
import { LogKey } from "@archival/core/logging";
import { LocalQueue } from "@archival/queue/localqueue";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { type DispatchEnv, dispatchApp } from "../src/index.ts";

const bindings: DispatchEnv["Bindings"] = {
	FETCH_QUEUE: new LocalQueue(),
	OBSERVABILITY_ENABLE_DEBUG_LOGS: true,
};

dispatchApp.use(logger());
dispatchApp.onError((err, c) => {
	c.get("logger")({
		[LogKey.RequestId]: c.get("requestId"),
		[LogKey.Error]: simplifyError(err),
	});

	if (err instanceof HTTPException) {
		return err.getResponse();
	}

	throw err;
});

console.log("Serving at localhost:8080");
Bun.serve({
	port: 8080,
	hostname: "localhost",
	fetch: (request) => dispatchApp.fetch(request, bindings),
});
