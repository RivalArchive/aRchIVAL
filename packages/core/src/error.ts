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
import type * as jsont from "./jsont";

/**
 * Simple type for handling errors.
 *
 * @param name - Name assigned to the error. Defaults to "SimpleError".
 * @param message -  * @param
 *
 * @remarks
 * Yes, "Simple" is a misnomer. Implemented in such a way to keep the class JSON serializable, which is
 * why this is a type and not a class. This allows for helpful error handling during RPC calls in Cloudflare
 * Workers, since sometimes errors crossing the RPC boundary can be sanitized.
 */
export type SimpleError = {
	/**
	 * Name assigned to the error. Defaults to "SimpleError".
	 */
	name: string;
	/**
	 * The error's message. This must be a static string. Use `context` for dynamic content.
	 */
	message: string;
	/**
	 * Traceback. The {@link newSimpleError} function can set this automatically if needed, or one can be provided.
	 */
	stack: string;
	/**
	 * Another SimpleError to indicate the reason this SimpleError was created. If this SimpleError was created
	 * due to an {@link Error} being raised, wrap it in {@link simplifyError}.
	 */
	cause?: SimpleError;
	/**
	 * JSON object containing dynamic variables that are specific to this instance of the SimpleError.
	 */
	context?: jsont.JsonObject;
	/**
	 * Indicates if the procedure which caused the SimpleError is retryable.
	 *
	 * @see https://developers.cloudflare.com/durable-objects/best-practices/error-handling/
	 */
	retryable?: boolean;
	/**
	 * Indicates if the error was caused because of resource exhaustion. These errors must not be retried.
	 *
	 * @see https://developers.cloudflare.com/durable-objects/best-practices/error-handling/
	 */
	overloaded?: boolean;
	/**
	 * Indicates if the error was raised on the other side of an RPC boundary.
	 *
	 * @see https://developers.cloudflare.com/durable-objects/best-practices/error-handling/
	 */
	remote?: boolean;
	/**
	 * This is a "private" property which is used to distinguish between SimpleErrors and {@link Error}s. To
	 * keep SimpleErrors JSON serializable, they must be implemented as a type instead of a class. Unfortunately,
	 * this means we cannot use `instanceof` to identify instances of SimpleErrors and instead need some other
	 * method for doing so.
	 * @private
	 */
	_simple: true;
};

/**
 * Create a new {@link SimpleError}.
 *
 * @param message - Set the static message of the {@link SimpleError}. Not optional.
 * @param options - Set properties of the {@link SimpleError}. Optional
 */
export function newSimpleError(
	message: string,
	options: {
		name?: string | undefined;
		cause?: SimpleError | undefined;
		context?: jsont.JsonObject | undefined;
		retryable?: boolean | undefined;
		overloaded?: boolean | undefined;
		remote?: boolean | undefined;
		stack?: string | undefined;
	} = {},
): SimpleError {
	const err = {
		message: message,
		name: options.name === undefined ? "SimpleError" : options.name,
		cause: options.cause,
		context: options.context,
		retryable: options.retryable,
		overloaded: options.overloaded,
		remote: options.remote,
		stack: options.stack !== undefined ? options.stack : "",
		_simple: true as true, // See https://github.com/microsoft/TypeScript/issues/19360.
	};

	if (err.stack === "") {
		Error.captureStackTrace(err);
	}

	return err;
}

/**
 * Return the given error as a {@link SimpleError}. Can be used in a catch clause to ensure that
 * the received error is always transformed into a {@link SimpleError}. If the given error is
 * a {@link SimpleError} then it will be returned without modification.
 */
export function simplifyError(err: Error | SimpleError | unknown): SimpleError {
	const simplifyUnknown = (e: unknown) =>
		newSimpleError("received error that isn't error-like", {
			context: { attemptedStringify: JSON.stringify(e) },
		});

	if (!(err instanceof Object)) {
		return simplifyUnknown(err);
	}

	if (Object.hasOwn(err, "_simple")) {
		return err as SimpleError;
	}

	if (!(err instanceof Error)) {
		return simplifyUnknown(err);
	}

	let cause: SimpleError | undefined;
	if (err.cause !== undefined) {
		cause = simplifyError(err.cause);
	}

	const simple = newSimpleError(err.message, {
		name: err.name,
		cause: cause,
		stack: err.stack,
	});

	return simple;
}

/**
 * Create a new {@link SimpleError} that was caused by a bug in the program. Using this constructor
 * for bugs, rather than {@link newSimpleError}, helps bugs to be more easily identified within code,
 * traces and logs.
 */
export function newSimpleBug(
	message: string,
	options: {
		context?: jsont.JsonObject | undefined;
		cause?: SimpleError | undefined;
	} = {},
): SimpleError {
	return newSimpleError(
		`BUG: ${message}`,
		Object.assign({ name: "Bug" }, options),
	);
}
