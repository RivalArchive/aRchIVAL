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
import type { JsonObject } from "@archival/core/jsont";
import type { Result } from "@archival/core/result";
import type { Queue } from "@archival/queue";
import { type Log, LogKey, LogValue } from "./kvs";

/**
 * StructuredLogFunction is the type definition of archival's logger.
 *
 * @param log - Log object to submit. Should be a literal, as there is no guarantee the object will not be modified.
 *
 * The goal is to keep it super simple and easy to use: no error is returned, it's not async, you give it a
 * JSON-compatible log object and that's that. It's up to middleware and exporters to contain the complexity of figuring
 * out what to do with logs after they are emitted.
 *
 * OTEL wraps logs in what they call a
 * {@link https://opentelemetry.io/docs/concepts/signals/logs/#log-record | LogRecord }. We're just creating a flat
 * object of JSON-serializable keys and values, which is simpler to use in code. It's a bit looser on typing, but
 * we can trust developers to ensure that the right value is passed to the right key.
 *
 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
 */
export type StructuredLogFunction = (log: Log) => void;

/**
 * Return a new log function which injects properties into the inputs passed to a log function. This allows for new
 * loggers to be constructed that carry a set of properties with them, rather than having to continually pass them
 * with each call.
 *
 * Note that the log given to the returned function will always be modified in place.
 *
 * @param injected- Properties to always inject.
 * @param logfn - Log function to wrap.
 */
export function withProperties(
	injected: Log,
	logfn: StructuredLogFunction,
): StructuredLogFunction {
	return (givenLog: Log) => {
		Object.assign(givenLog, injected);
		return logfn(givenLog);
	};
}

/**
 * Return a new log function which supports optional debug logs.
 *
 * Debug logs are identified by the log key {@link LogKey.SeverityText} or {@link LogKey.SeverityNumber} with a value of
 * {@link LogValue.SeverityTextDebug} or {@link LogValue.SeverityNumberDebug} respectively.
 *
 * @param debugEnabled - Toggle to determine if debug logs should be emitted. If true, this function just returns the
 * given log function. If false, a log function is returned which drops debug logs.
 * @param logfn - Log function to wrap.
 */
export function withDebug(
	debugEnabled: boolean,
	logfn: StructuredLogFunction,
): StructuredLogFunction {
	if (debugEnabled) {
		return logfn;
	}
	return (givenLog: Log) => {
		// The type of Log allows for us to only need to check either SeverityNumber or SeverityText. Typescript will
		// enforce that the SeverityNumber and SeverityText match appropriately and will actually raise a warning if we
		// try to check both keys here.
		if (givenLog[LogKey.SeverityNumber] !== LogValue.SeverityNumberDebug) {
			return logfn(givenLog);
		}
	};
}

/**
 * Return a new log function which automatically injects a unix timestamp if it is missing.
 *
 * Note that the log given to the returned function will always be modified in place.
 *
 * @see {@link LogKey.TimestampUnixNano}
 */
export function withTimestamps(
	logfn: StructuredLogFunction,
): StructuredLogFunction {
	return (givenLog: Log) => {
		if (givenLog[LogKey.TimestampUnixNano] === undefined) {
			Object.assign(givenLog, {
				[LogKey.TimestampUnixNano]: Date.now() * 1_000_000,
			});
		}
		return logfn(givenLog);
	};
}

/**
 * Chain multiple log functions together in a series. Functions are called in the order they are given. If a log
 * function throws an error, the chain will be broken and no other log functions will be called.
 */
export function withChain(
	...logfns: StructuredLogFunction[]
): StructuredLogFunction {
	return (givenLog: Log) => {
		for (const logfn of logfns) {
			logfn(givenLog);
		}
	};
}

/**
 * Log JSON-serialized messages to the console.
 *
 * An alias for `console.log(JSON.stringify(obj))`.
 */
export function consoleLogger(obj: JsonObject): void {
	console.log(JSON.stringify(obj));
}

/**
 * Send logs to a queue for later processing. Assumes the queue is already connected.
 *
 * It's the responsibility of the caller to continually await and purge promises from the given array. Since calls to
 * logs are synchronous, and the queue is asynchronous, there needs to be some way for promises to be managed.
 *
 * In a serverless context, this looks like the request handler calling Promise.all on the given array at the end of
 * request processing.
 */
export function queueLogger(
	queue: Queue,
	promiseArray: Promise<Result<undefined>>[],
): StructuredLogFunction {
	return (givenObj: JsonObject) => {
		promiseArray.push(queue.send(givenObj));
	};
}
