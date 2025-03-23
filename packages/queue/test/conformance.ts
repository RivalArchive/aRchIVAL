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

import type { JsonObject } from "@archival/core/jsont";

import type { Queue } from "../src/index";

function createRandomMessage(): JsonObject {
	return {
		[faker.string.sample()]: faker.string.sample(),
		[faker.string.sample()]: faker.helpers.uniqueArray(faker.string.sample, 3),
		[faker.string.sample()]: faker.number.int(),
		[faker.string.sample()]: !!faker.helpers.maybe(() => true),
	};
}

export function checkConformanceForQueue(name: string, newQueue: () => Queue) {
	describe(`conformance-${name}`, async () => {
		it("can be connected and disconnected", async () => {
			const myQueue = newQueue();
			let result = await myQueue.connect();
			expect(result.err).toBeUndefined();
			result = await myQueue.disconnect();
			expect(result.err).toBeUndefined();
		});

		it("can send and receive messages one at a time", async () => {
			const myQueue: Queue = newQueue();
			const connectResult = await myQueue.connect();
			expect(connectResult.err).toBeUndefined();

			console.log(`Faker seed: ${faker.seed()}`);
			for (let i = 0; i < 25; i++) {
				const msg = createRandomMessage();
				const sendResult = await myQueue.send(msg);
				expect(sendResult.err).toBeUndefined();

				const receiveResult = await myQueue.receive();
				expect(receiveResult.err).toBeUndefined();
				expect(receiveResult.ok).toEqual(msg);
			}
		});

		it("can send and receive multiple messages at a time", async () => {
			const myQueue: Queue = newQueue();
			const connectResult = await myQueue.connect();
			expect(connectResult.err).toBeUndefined();

			console.log(`Faker seed: ${faker.seed()}`);
			for (let i = 0; i < 10; i++) {
				const msgs = faker.helpers.uniqueArray(createRandomMessage, 5);

				const sendPromises: Promise<void>[] = msgs.map((msg) =>
					myQueue
						.send(msg)
						.then((result) => expect(result.err).toBeUndefined())
						.catch(
							// If the Promise is rejected due to an error, then print out the
							// error by using toBeUndefined(). Previously, fail() was used but
							// this didn't print out the reason.
							(reason) => expect(reason).toBeUndefined(),
						),
				);

				const receiveMsgs: Promise<undefined | JsonObject>[] = msgs.map((msg) =>
					myQueue
						.receive()
						.then((result) => {
							expect(result.err).toBeUndefined();
							expect(msgs).toContain(msg);
							return msg;
						})
						.catch((reason: unknown) => expect(reason).toBeUndefined()),
				);

				await Promise.all(sendPromises);
				await Promise.all(receiveMsgs).then((receivedMsgs) => {
					expect(receivedMsgs.sort()).toEqual(msgs.sort());
				});
			}
		});
	});
}
