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
import type { SimpleError } from "./error";
/**
 * Return type to allow for passing around data and errors without relying on try-catch.
 * This allows easily distinguishing between expected errors and bugs, and for passing up
 * helpful error messages while working with DO RPC calls which sanitize bubbled up errors
 * to the call-site.
 *
 * Inspired by the Result type in Rust.
 */
export type Result<T> =
	| {
			readonly ok: T;
			readonly err?: never;
	  }
	| {
			readonly ok?: never;
			readonly err: SimpleError;
	  };
