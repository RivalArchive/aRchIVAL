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

import { Context } from "../src/context.ts";

describe("unit-Context", async () => {
	it("can cancel background task", async () => {
		const countFn = async (ctx: Context): Promise<number> => {
			let mycount = 0;
			while (!ctx.done()) {
				mycount += 1;
				await Bun.sleep(10);
			}
			return mycount;
		};

		const ctx: Context = new Context();
		const countPromise = countFn(ctx);

		await Bun.sleep(50);
		ctx.cancel();

		const count = await countPromise;
		expect(count).toBeGreaterThanOrEqual(5);
	});

	it("can cancel background task via a parent", async () => {
		const countFn = async (ctx: Context): Promise<number> => {
			let mycount = 0;
			while (!ctx.done()) {
				mycount += 1;
				await Bun.sleep(10);
			}
			return mycount;
		};

		const parentCtx: Context = new Context();
		const ctx: Context = new Context(parentCtx);
		const countPromise = countFn(ctx);

		await Bun.sleep(50);
		parentCtx.cancel();

		const count = await countPromise;
		expect(count).toBeGreaterThanOrEqual(5);
	});

	it("can cancel background task via a grandparent", async () => {
		const countFn = async (ctx: Context): Promise<number> => {
			let mycount = 0;
			while (!ctx.done()) {
				mycount += 1;
				await Bun.sleep(10);
			}
			return mycount;
		};

		const grandParentCtx: Context = new Context();
		const parentCtx: Context = new Context(grandParentCtx);
		const ctx: Context = new Context(parentCtx);
		const countPromise = countFn(ctx);

		await Bun.sleep(50);
		grandParentCtx.cancel();

		const count = await countPromise;
		expect(count).toBeGreaterThanOrEqual(5);
	});
});
