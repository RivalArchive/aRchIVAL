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
import { describe, expect, it, mock } from "bun:test";
import {
	withChain,
	withDebug,
	withProperties,
	withTimestamps,
} from "../../src/logs/fns";
import { type Log, LogKey, LogValue } from "../../src/logs/kvs";

describe("unit-withProperties", () => {
	it("can add properties to an object", () => {
		const baseLog = mock((_: Log) => undefined);
		const l = withProperties({ a: "b" }, baseLog);

		l({ c: "d" });
		expect(baseLog).toHaveBeenCalledTimes(1);
		let received = baseLog.mock.lastCall;
		expect(received).toBeDefined();
		if (received === undefined) {
			throw "unreachable";
		}
		expect(received[0]).toEqual({ a: "b", c: "d" });

		l({ e: "f" });
		expect(baseLog).toHaveBeenCalledTimes(2);
		received = baseLog.mock.lastCall;
		expect(received).toBeDefined();
		if (received === undefined) {
			throw "unreachable";
		}
		expect(received[0]).toEqual({ a: "b", e: "f" });
	});
});

describe("unit-withDebugLogs", () => {
	function check(opts: {
		debugEnabled: boolean;
		invoked: boolean;
		input: Log;
	}) {
		const baseLog = mock((_: Log) => undefined);
		withDebug(opts.debugEnabled, baseLog)(opts.input);

		if (opts.invoked) {
			expect(baseLog).toBeCalledTimes(1);
			expect(baseLog.mock.lastCall).toBeDefined();
			if (baseLog.mock.lastCall === undefined) {
				throw "unreachable";
			}
			expect(baseLog.mock.lastCall[0]).toEqual(opts.input);
		} else {
			expect(baseLog).toBeCalledTimes(0);
		}
	}

	it("ignores debug logs when debug is disabled", () => {
		check({
			debugEnabled: false,
			invoked: false,
			input: {
				[LogKey.SeverityNumber]: LogValue.SeverityNumberDebug,
				[LogKey.SeverityText]: LogValue.SeverityTextDebug,
			},
		});
	});

	it("allows non-debug logs when debug is disabled", () => {
		const cases: Log[] = [
			{ [LogKey.SeverityNumber]: LogValue.SeverityNumberWarn },
			{},
			{ a: "b" },
		];

		for (const c of cases) {
			check({ debugEnabled: false, invoked: true, input: c });
		}
	});

	it("passes debug logs when debug is enabled", () => {
		const cases: Log[] = [
			{ [LogKey.SeverityNumber]: LogValue.SeverityNumberDebug },
			{ [LogKey.SeverityNumber]: LogValue.SeverityNumberDebug, a: "b" },
		];

		for (const c of cases) {
			check({ debugEnabled: true, invoked: true, input: c });
		}
	});

	it("passes non-debug logs when debug is enabled", () => {
		const cases: Log[] = [
			{},
			{ [LogKey.SeverityNumber]: LogValue.SeverityNumberDebug, one: "two" },
			{ a: "b" },
			{ [LogKey.SeverityNumber]: LogValue.SeverityNumberDebug, a: "b" },
		];

		for (const c of cases) {
			check({ debugEnabled: true, invoked: true, input: c });
		}
	});
});

describe("unit-withTimestamps", () => {
	it("adds the current time to a log", () => {
		const baseLog = mock((_: Log) => undefined);
		const currentTimeNs = Date.now() * 1_000_000;
		const l = withTimestamps(baseLog);

		l({ a: "b" });
		expect(baseLog).toHaveBeenCalledTimes(1);
		const result = baseLog.mock.lastCall;
		expect(result).toBeDefined();
		if (result === undefined) {
			throw "unreachable";
		}

		expect(result[0].a).toEqual("b");
		expect(Object.keys(result[0])).toEqual(["a", LogKey.TimestampUnixNano]);

		const ts = result[0][LogKey.TimestampUnixNano];
		expect(ts).toBeDefined();
		if (ts === undefined) {
			throw "unreachable";
		}
		expect(ts).toBeGreaterThanOrEqual(currentTimeNs);
		expect(ts).toBeLessThan((Date.now() + 100) * 1_000_000);
	});
});

describe("unit-withChain", () => {
	it("chains multiple loggers together in order", () => {
		const calls: string[] = [];
		const firstLink = mock((_: Log) => calls.push("first"));
		const secondLink = mock((_: Log) => calls.push("second"));
		const l = withChain(firstLink, secondLink);

		const checkLink = (link: typeof firstLink) => {
			expect(link).toHaveBeenCalledTimes(1);
			const result = link.mock.lastCall;
			expect(result).toBeDefined();
			if (result === undefined) {
				throw "unreachable";
			}
			expect(result[0]).toEqual({ a: "b" });
		};

		l({ a: "b" });
		checkLink(firstLink);
		checkLink(secondLink);
		expect(calls).toEqual(["first", "second"]);
	});

	it("breaks chain when a logger throws an error", () => {
		const firstLink = mock((_: Log) => undefined);
		const secondLink = mock((_: Log) => {
			throw "oops";
		});
		const l = withChain(firstLink, secondLink);

		try {
			l({ a: "b" });
		} catch (e: unknown) {
			expect(e).toEqual("oops");
			expect(firstLink).toHaveBeenCalledTimes(1);
			expect(secondLink).toHaveBeenCalledTimes(1);
		}
	});
});
