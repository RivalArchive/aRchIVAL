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

/**
 * Standard FIFO queue within archival to allow for buffered work passing.
 *
 * Each message is a JSON-serializable object. A message is only consumed
 * by a single consumer.
 */
export interface Queue extends AsyncDisposable {
	/**
	 * Initiate a connection to the queue. This may be a no-op depending
	 * on the implementation, but should always be called anyways.
	 */
	connect: () => Promise<Result<undefined>>;

	/**
	 * Shutdown the connection to the queue. This may be a no-op depending
	 * on the implementation, but should always be called anyways.
	 */
	disconnect: () => Promise<Result<undefined>>;

	/**
	 * Send a message onto the queue.
	 *
	 * @param message - Message to send. Must be json serializable, otherwise
	 * an error is returned.
	 */
	send: (message: JsonObject) => Promise<Result<undefined>>;

	/**
	 * Get a message from the queue. Promise resolves when a message is
	 * obtained from the queue.
	 */
	receive: () => Promise<Result<JsonObject>>;
}
