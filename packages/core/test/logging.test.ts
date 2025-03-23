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
import { describe, expect, it } from "bun:test";
import type { JsonObject } from "../src/jsont";
import {
	LogKey,
	LogValue,
	logWithDebug,
	logWithProperties,
} from "../src/logging";

describe("WithProperties", () => {
	it("can add properties to an object", async () => {
		const state: { invoked: boolean; given?: JsonObject } = {
			invoked: false,
			given: undefined,
		};
		const baseLog = (givenProps: JsonObject) => {
			state.invoked = true;
			state.given = givenProps;
		};
		const l = logWithProperties({ a: "b" }, baseLog);

		l({ c: "d" });

		expect(state.invoked).toEqual(true);
		expect(state.given).toBeDefined();
		// @ts-ignore
		expect(state.given.a).toEqual("b");
		// @ts-ignore
		expect(state.given.c).toEqual("d");

		state.invoked = false;
		state.given = undefined;

		l({ e: "f" });
		expect(state.invoked).toEqual(true);
		expect(state.given).toBeDefined();
		// @ts-ignore
		expect(state.given.a).toEqual("b");
		// @ts-ignore
		expect(state.given.e).toEqual("f");
		// @ts-ignore
		expect(state.given.c).toBeUndefined();
	});
});

describe("WithDebugLogs", () => {
	function check(opts: {
		debugEnabled: boolean;
		invoked: boolean;
		input: JsonObject;
	}) {
		const state: { invoked: boolean; given?: JsonObject } = {
			invoked: false,
			given: undefined,
		};

		const baseLog = (result: JsonObject) => {
			state.invoked = true;
			state.given = result;
		};

		logWithDebug(opts.debugEnabled, baseLog)(opts.input);

		expect(state.invoked).toEqual(opts.invoked);
		if (opts.invoked) {
			expect(state.given).toEqual(opts.input);
		}
	}

	it("ignores debug logs when debug is disabled", async () => {
		check({
			debugEnabled: false,
			invoked: false,
			input: { [LogKey.Debug]: LogValue.Debug },
		});
	});

	it("allows non-debug logs when debug is disabled", async () => {
		const cases = [{ [LogKey.Debug]: false }, {}, { a: "b" }];

		for (const c of cases) {
			check({ debugEnabled: false, invoked: true, input: c });
		}
	});

	it("passes debug logs when debug is enabled", async () => {
		const cases = [
			{ [LogKey.Debug]: LogValue.Debug },
			{ [LogKey.Debug]: LogValue.Debug, a: "b" },
		];

		for (const c of cases) {
			check({ debugEnabled: true, invoked: true, input: c });
		}
	});

	it("passes non-debug logs when debug is enabled", async () => {
		const cases = [
			{},
			{ [LogKey.Debug]: LogValue.Debug, one: "two" },
			{ a: "b" },
			{ [LogKey.Debug]: LogValue.Debug, a: "b" },
		];

		for (const c of cases) {
			check({ debugEnabled: true, invoked: true, input: c });
		}
	});
});
