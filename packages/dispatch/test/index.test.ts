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
import { LocalQueue } from "@archival/queue/localqueue";
import { faker } from "@faker-js/faker";
import { type DispatchEnv, dispatchApp } from "../src/index";

function newDispatchRequest(url: string): Request {
	return new Request("https://localhost:8080/", {
		method: "POST",
		body: url,
	});
}

function newTestBindings(): DispatchEnv["Bindings"] {
	return {
		FETCH_QUEUE: new LocalQueue(),
	};
}

describe("Dispatch::POST::root", () => {
	it("ignores empty requests", async () => {
		const response = await dispatchApp.fetch(
			newDispatchRequest(""),
			newTestBindings(),
		);
		expect(response.status).toEqual(400);
	});

	it("ignores things that aren't URLs", async () => {
		console.log(`Faker seed: ${faker.seed()}`);
		for (const randomString of faker.helpers.uniqueArray(
			faker.string.sample,
			10,
		)) {
			const response = await dispatchApp.fetch(
				newDispatchRequest(randomString),
				newTestBindings(),
			);
			expect(response.status).toEqual(400);
		}
	});

	it("ignores unknown urls", async () => {
		console.log(`Faker seed: ${faker.seed()}`);
		for (const randomUrl of faker.helpers.uniqueArray(faker.internet.url, 10)) {
			const response = await dispatchApp.fetch(
				newDispatchRequest(randomUrl),
				newTestBindings(),
			);
			expect(response.status).toEqual(400);
		}
	});

	it("publishes twitter urls", async () => {
		console.log(`Faker seed: ${faker.seed()}`);
	});
});
