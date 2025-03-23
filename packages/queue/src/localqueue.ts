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
import { Database, type Statement } from "bun:sqlite";
import {
	newSimpleBug,
	newSimpleError,
	simplifyError,
} from "@archival/core/error";
import type { JsonObject } from "@archival/core/jsont";
import type { Result } from "@archival/core/result";
import {
	ErrorNameMessageMustBeJson,
	ErrorNameQueueConnect,
	ErrorNameReceiveFailure,
	ErrorNameSendFailure,
} from "./errors";
import type { Queue } from "./index";

/**
 * A single row within the messages table.
 *
 * @remarks
 * This class does not have a constructor because it is only used by the
 * bun sqlite library to understand the typing of rows in the table.
 */
class MessagesTableRow {
	// @ts-expect-error
	message: string;
}

/**
 * Options to control the behavior of the LocalQueue
 */
export type LocalQueueOptions = {
	/**
	 * The file on disk used to store the backing database.
	 * If set to an empty string or `":memory:"`, then the queue will not be persisted to disk
	 * and will remain in-memory
	 */
	filename: string;
};

/**
 * LocalQueue is a sqlite-backed FIFO queue implementation.
 */
export class LocalQueue implements Queue {
	readonly #filename: string;
	#database?: Database;
	#deleteQuery?: Statement<MessagesTableRow, null[]>;
	#insertQuery?: Statement<MessagesTableRow, { message: string }[]>;

	constructor(
		options: LocalQueueOptions = {
			filename: ":memory:",
		},
	) {
		this.#filename = options.filename;
	}

	async connect(): Promise<Result<undefined>> {
		this.#database = new Database(this.#filename, {
			strict: true,
			create: true,
			readwrite: true,
		});

		try {
			this.#database
				.query(`
					CREATE TABLE IF NOT EXISTS
						messages
						(
							message TEXT NOT NULL
						);
				`)
				.run();
		} catch (e: unknown) {
			return {
				err: newSimpleError("unable to create underlying sqlite table", {
					name: ErrorNameQueueConnect,
					cause: simplifyError(e),
				}),
			};
		}

		try {
			this.#deleteQuery = this.#database
				.query(`
					DELETE FROM
						messages
					WHERE
						rowid = (
							SELECT
								min(rowid)
							FROM
								messages
						)
					RETURNING
						*;
				`)
				.as(MessagesTableRow);
		} catch (e: unknown) {
			return {
				err: newSimpleError("unable to cache query used to receive messages", {
					name: ErrorNameQueueConnect,
					cause: simplifyError(e),
				}),
			};
		}

		try {
			this.#insertQuery = this.#database.query(`
				INSERT INTO
					messages
					(
						 message
					)
				VALUES
					(
						 $message
					);
			`);
		} catch (e: unknown) {
			return {
				err: newSimpleError("unable to cache query used to send messages", {
					name: ErrorNameQueueConnect,
					cause: simplifyError(e),
				}),
			};
		}

		return { ok: undefined };
	}

	async send(message: JsonObject): Promise<Result<undefined>> {
		if (this.#database === undefined) {
			const connectResult = await this.connect();
			if (connectResult.err !== undefined) {
				return connectResult;
			}
		}
		if (this.#database === undefined) {
			return {
				err: newSimpleBug("database was not defined after connecting"),
			};
		}
		if (this.#insertQuery === undefined) {
			return {
				err: newSimpleBug("insert query was not defined after connecting"),
			};
		}

		let messageAsJson: string;
		try {
			messageAsJson = JSON.stringify(message);
		} catch (e: unknown) {
			return {
				err: newSimpleError("message must be valid json", {
					name: ErrorNameMessageMustBeJson,
					cause: simplifyError(e),
					context: { message: message },
				}),
			};
		}

		try {
			this.#insertQuery.run({ message: messageAsJson });
		} catch (e: unknown) {
			return {
				err: newSimpleError("unable to send message", {
					name: ErrorNameSendFailure,
					cause: simplifyError(e),
				}),
			};
		}

		return { ok: undefined };
	}

	async receive(): Promise<Result<JsonObject>> {
		if (this.#database === undefined) {
			const connectResult = await this.connect();
			if (connectResult.err !== undefined) {
				return connectResult;
			}
		}
		if (this.#database === undefined) {
			return {
				err: newSimpleBug("database was not defined after connecting"),
			};
		}
		if (this.#deleteQuery === undefined) {
			return {
				err: newSimpleBug("delete query was not defined after connecting"),
			};
		}

		let result: MessagesTableRow | null = null;
		while (result == null) {
			try {
				result = this.#deleteQuery.get();
			} catch (e: unknown) {
				return {
					err: newSimpleError("unable to get new message", {
						name: ErrorNameReceiveFailure,
						cause: simplifyError(e),
					}),
				};
			}
			await Bun.sleep(50);
		}

		let msg: JsonObject;
		try {
			msg = JSON.parse(result.message);
		} catch (e: unknown) {
			return {
				err: newSimpleBug("received message is not valid json", {
					cause: simplifyError(e),
					context: { received: result.message },
				}),
			};
		}

		return { ok: msg };
	}

	async disconnect(): Promise<Result<undefined>> {
		if (this.#database === undefined) {
			return { ok: undefined };
		}
		this.#database.close(false);
		return { ok: undefined };
	}

	async [Symbol.asyncDispose](): Promise<void> {
		this.disconnect();
		return;
	}
}
