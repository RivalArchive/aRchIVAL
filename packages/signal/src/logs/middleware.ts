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
import { createMiddleware } from "hono/factory";

import type { Result } from "@archival/core/result";
import type { Queue } from "@archival/queue";

import {
	type StructuredLogFunction,
	consoleLogger,
	queueLogger,
	withChain,
	withDebug,
} from "./fns";

export type SignalLogsBindings = {
	LOG_QUEUE?: Queue;
	LOG_DEBUG?: boolean;
};

export type SignalLogsVariables = {
	logger: StructuredLogFunction;
};

export type SignalLogsEnv = {
	Bindings: SignalLogsBindings;
	Variables: SignalLogsVariables;
};

export const structuredLoggerMiddleware = createMiddleware<SignalLogsEnv>(
	async (c, next) => {
		const baseLogger = withDebug(c.env.LOG_DEBUG === true, consoleLogger);

		if (c.env.LOG_QUEUE !== undefined) {
			const promiseArray: Promise<Result<undefined>>[] = [];
			const logger = withChain(
				baseLogger,
				queueLogger(c.env.LOG_QUEUE, promiseArray),
			);
			c.set("logger", logger);
			await next();
			await Promise.all(promiseArray);
		} else {
			c.set("logger", baseLogger);
			await next();
		}
	},
);
