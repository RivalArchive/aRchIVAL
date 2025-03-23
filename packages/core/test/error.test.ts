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
import { faker } from "@faker-js/faker";

import { type SimpleError, simplifyError } from "../src/error";

function createRandomError(): Error {
	const err = new Error(faker.string.sample(), {
		cause: faker.helpers.maybe(() => createRandomError()),
	});
	err.name = faker.string.sample();
	return err;
}

function createRandomSimpleError(): SimpleError {
	return {
		name: faker.string.sample(),
		message: faker.string.sample(),
		stack: faker.string.sample(),
		cause: faker.helpers.maybe(() => createRandomSimpleError()),
		context: {
			color: faker.color.human(),
			flight: faker.airline.flightNumber(),
			favoriteFoods: faker.helpers.uniqueArray(faker.food.dish, 5),
		},
		retryable: !!faker.helpers.maybe(() => true),
		overloaded: !!faker.helpers.maybe(() => true),
		remote: !!faker.helpers.maybe(() => true),
		_simple: true,
	};
}

describe("SimpleError", () => {
	it("is JSON serializable", async () => {
		console.log(`Faker seed: ${faker.seed()}`);
		for (let i = 0; i < 500; i++) {
			const err = createRandomSimpleError();
			const jsonified = JSON.parse(JSON.stringify(err));
			expect(err).toEqual(jsonified);
		}
	});
});

describe("simplifyError", () => {
	it("returns given SimpleError", async () => {
		console.log(`Faker seed: ${faker.seed()}`);
		for (let i = 0; i < 500; i++) {
			const err = createRandomSimpleError();
			const result = simplifyError(err);
			expect(err).toEqual(result);
		}
	});

	it("returns simplified Error", async () => {
		console.log(`Faker seed: ${faker.seed()}`);
		const checkEqual = (e: Error, s: SimpleError) => {
			expect(s.name).toEqual(e.name);
			expect(s.message).toEqual(e.message);

			if (e.stack) {
				expect(s.stack).toContain(e.stack);
			}

			if (e.cause) {
				expect(s.cause).toBeDefined();
				checkEqual(e.cause as Error, s.cause as SimpleError);
			}
		};

		for (let i = 0; i < 500; i++) {
			const err = createRandomError();
			const result = simplifyError(err);
			checkEqual(err, result);
		}
	});
});
