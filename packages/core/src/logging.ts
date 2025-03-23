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
import type { JsonObject } from "./jsont";

/**
 * Simple set of logging helper functions which wrap `console.log` to provide structured logging.
 */

export type StructuredLogFunction = (obj: JsonObject) => void;

// Define common keys names.

/**
 * Define a standard set of keys to use within logs to combat typos.
 */
export enum LogKey {
	/**
	 * Indicate the source which generated the log message, such as the object name.
	 */
	Source = "source",

	/**
	 * Indicates the name of the worker which generated the log.
	 */
	Worker = "worker",

	/**
	 * The actual log message.
	 */
	Message = "msg",

	/**
	 * An error associated with the log, typically sourced from a catch block.
	 */
	Error = "err",

	/**
	 * Attach a DurableObject's alarm number to the log.
	 */
	DOAlarm = "do_alarm",

	/**
	 * Indicate if the log is a debug log.
	 * @see {@link LogValue.Debug} for the associated value.
	 */
	Debug = "debug",

	/**
	 * ID to attach to the log for tracing.
	 */
	RequestId = "id",

	/**
	 * Any Url that acts as relevant context.
	 */
	Url = "url",

	/**
	 * For E2E tests, the name of the test being executed.
	 */
	TestName = "testName",

	/**
	 * For E2E tests, the ID of the test execution.
	 */
	TestId = "testId",
}

/**
 * Define a standard set of values to use within logs to combat typos.
 */
export enum LogValue {
	/**
	 * Indicate the log is a debug log.
	 * @see {@link LogKey.Debug} for the associated key.
	 */
	Debug = 1,
}

/**
 * Return a new log function which always attaches the properties from the given object.
 */
export function logWithProperties(
	props: JsonObject,
	logfn: StructuredLogFunction,
) {
	return (givenProps: JsonObject) => {
		// Create a container for all the props, otherwise we'd modify pros or givenProps in-place.
		const p = {};
		Object.assign(p, props);
		Object.assign(p, givenProps);
		return logfn(p);
	};
}

/**
 * Return a new log function which supports optional debug logs. Debug logs are marked by the presence of
 * a Key.Debug=Value.Debug pair.
 *
 * @param debugEnabled - Toggle to determine if debug logs should be emitted.
 * @param logfn - Log function to wrap.
 */
export function logWithDebug(
	debugEnabled: boolean,
	logfn: StructuredLogFunction,
) {
	if (debugEnabled) {
		return logfn;
	}
	return (givenProps: JsonObject) => {
		if (
			!givenProps[LogKey.Debug] ||
			givenProps[LogKey.Debug] !== LogValue.Debug
		) {
			return logfn(givenProps);
		}
	};
}

/**
 * This interface defines an object which contains the property used to enable or disable debug logging.
 */
export interface ObservabilityLoggingVariables {
	OBSERVABILITY_ENABLE_DEBUG_LOGS?: boolean;
}

/**
 * Resolve the root logger based on the worker's configuration.
 */
export function resolveRootLogger(
	env: ObservabilityLoggingVariables,
): StructuredLogFunction {
	return logWithDebug(
		env.OBSERVABILITY_ENABLE_DEBUG_LOGS === true,
		(props: JsonObject): void => {
			console.log(JSON.stringify(props));
		},
	);
}

export type StructuredLoggerMiddlewareVariables = {
	logger: StructuredLogFunction;
};

/**
 * Middleware for hono which exposes a logger within the context.
 * Creates a `logger` key which can be used as a root logger within a path handler
 * for extra log messages, outside of hono's logger middleware.
 */
export const structuredLoggerMiddleware = createMiddleware<{
	Variables: StructuredLoggerMiddlewareVariables;
}>(async (c, next) => {
	c.set("logger", resolveRootLogger(c.env as ObservabilityLoggingVariables));
	await next();
});
