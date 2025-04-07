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
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { ofetch } from "ofetch";

import { Context } from "@archival/core/context";
import { newSimpleBug } from "@archival/core/error";
import type { JsonObject } from "@archival/core/jsont";
import type { Result } from "@archival/core/result";
import { LocalQueue } from "@archival/queue/localqueue";
import { ComposeDirectoryPath, ComposeHandler } from "@archival/test/compose";

import { BUILD_VERSION, PACKAGE_NAME } from "../../../src/build";
import { OtelJsonHttpLogExporter } from "../../../src/logs/exporters/otel";
import { consoleLogger } from "../../../src/logs/fns";
import { type Log, LogKey, LogValue } from "../../../src/logs/kvs";

class LocalQueueWithArtificialDelay extends LocalQueue {
	minDelay: number;
	maxDelay: number;

	constructor(minDelay: number, maxDelay: number) {
		super();
		this.minDelay = minDelay;
		this.maxDelay = maxDelay;
	}

	async receive(ctx: Context): Promise<Result<JsonObject>> {
		await Bun.sleep(
			faker.number.int({ min: this.minDelay, max: this.maxDelay }),
		);
		return super.receive(ctx);
	}

	async send(message: JsonObject): Promise<Result<undefined>> {
		return super.send(message);
	}
}

function generateByteStringForId(numBytes: number): string {
	return faker.helpers
		.uniqueArray(() => faker.number.hex({ min: 0x10, max: 0xff }), numBytes)
		.join("")
		.toUpperCase();
}

function newRandomLog(): Log {
	const log = {
		// Loki is specific about the dates it will accept, so use a current one even if it breaks repeatability
		[LogKey.TimestampUnixNano]: Date.now() * 1_000_000,
		[LogKey.TraceId]: generateByteStringForId(16),
		[LogKey.SpanId]: generateByteStringForId(8),
		[LogKey.ServiceName]: "functional-OtelJsonHttpLogExporter",
		[LogKey.ServiceVersion]: "0.1.0",
		[LogKey.Message]: faker.lorem.sentence(),
		flightNumber: faker.airline.flightNumber(),
		isThisTrue: faker.helpers.maybe(() => true) ?? false,
		coolWords: faker.helpers.uniqueArray(faker.word.sample, 5),
		namesToUrls: Object.fromEntries(
			faker.helpers.uniqueArray(
				() => [faker.internet.displayName(), faker.internet.url()],
				3,
			),
		),
	};

	/**
	 * This is structured very purposefully here to allow typescript to understand that
	 * severityNumber and severityText match.
	 */
	const severityNumber = faker.helpers.arrayElement([
		LogValue.SeverityNumberDebug,
		LogValue.SeverityNumberWarn,
		LogValue.SeverityNumberFatal,
	]);

	switch (severityNumber) {
		case LogValue.SeverityNumberDebug:
			log[LogKey.SeverityNumber] = LogValue.SeverityNumberDebug;
			log[LogKey.SeverityText] = LogValue.SeverityTextDebug;
			break;
		case LogValue.SeverityNumberWarn:
			log[LogKey.SeverityNumber] = LogValue.SeverityNumberWarn;
			log[LogKey.SeverityText] = LogValue.SeverityTextWarn;
			break;
		case LogValue.SeverityNumberFatal:
			log[LogKey.SeverityNumber] = LogValue.SeverityNumberFatal;
			log[LogKey.SeverityText] = LogValue.SeverityTextFatal;
			break;
		default:
			throw newSimpleBug("unhandled severity number", {
				context: { severityNumber: severityNumber },
			});
	}

	return log;
}

async function checkLokiForLogs(logs: Log[]) {
	/**
	let response;
	for (let attempt = 0; attempt <= 5; attempt += 1) {
		// This request can take a really long time but that's expected (5-10 seconds).
		response = await ofetch(
			"http://localhost:3100/loki/api/v1/query_range",
			{
				params: {
					"query": `{service_name="functional-OtelJsonHttpLogExporter"}`,
					/**
					 * To check we sent the correct number of logs, we have to increase the
					 * limit beyond what we're expecting.
					 */
	/**
					"limit": logs.length * 2,
				},
				responseType: "json",
				verbose: true,
			},
		);
		expect(response.status).toBeDefined();
		expect(response.data).toBeDefined();

		const numReceived = response.data.result.length;
		if (numReceived == logs.length) {
			break
		}

		console.log(`Received ${numReceived} logs, want ${logs.length}. Will try again in three seconds.`)
		await Bun.sleep(3000);
	}
	*/

	const response = await ofetch(
		"http://localhost:3100/loki/api/v1/query_range",
		{
			params: {
				query: `{service_name="functional-OtelJsonHttpLogExporter"}`,
				/**
				 * To check we sent the correct number of logs, we have to increase the
				 * limit beyond what we're expecting.
				 */
				limit: logs.length * 2,
			},
			responseType: "json",
			verbose: true,
		},
	);
	expect(response.status).toBeDefined();
	expect(response.data).toBeDefined();

	const { status, data } = response;
	expect(status).toEqual("success");
	expect(data.resultType).toEqual("streams");
	expect(data.result.length).toEqual(logs.length);
	expect(data.result).toBeArrayOfSize(logs.length);

	/**
	 * The relevant part of the result looks like this:
	 * {
	 *   "status": "success",
	 *   "data": {
	 *     "resultType": "streams",
	 *     "result": [{
	 *       "stream": {
	 *         "detected_level": "warn",
	 *         "observed_timestamp": "1743822374140000000",
	 *         "scope_name": "@archival/signal",
	 *         "scope_version": "unknown",
	 *         "service_name": "functional-OtelJsonHttpLogExporter",
	 *         "service_version": "0.1.0",
	 *         "severity_number": "13",
	 *         "severity_text": "warn",
	 *         "span_id": "eee19b7ec3c1b174",
	 *         "trace_id": "5b8efff798038103d269b633813fc60c"
	 *       },
	 *       "values": [
	 *         [
	 *           "1743822374084000000",
	 *           "{\"boolattr\":false,\"kvattr\":{\"a\":\"b\"},\"listattr\":[\"a\",\"b\",\"c\"],\"message\":\"hey there\",\"service.name\":\"functional::OtelJsonHttpLogExporter\",\"service.version\":\"0.1.0\",\"stringattr\":\"xyz\"}"
	 *         ]
	 *       ]
	 *     }]
	 *   }
	 * }
	 */

	// Sort logs by the span id, which should always be unique, so we don't have to worry about ordering.
	for (const log of logs) {
		expect(log[LogKey.SpanId]).toBeDefined();
	}
	const sortedGiven = logs.sort((a: Log, b: Log) => {
		const spanA = a[LogKey.SpanId];
		if (spanA === undefined) {
			throw "unreachable";
		}
		const spanB = b[LogKey.SpanId];
		if (spanB === undefined) {
			throw "unreachable";
		}
		return spanA.localeCompare(spanB);
	});

	type resultWithSpanId = {
		stream: {
			span_id: string;
		};
	};

	for (const log of data.result) {
		expect(log.stream.span_id).toBeDefined();
	}

	const sortedReceived = data.result.sort(
		(a: resultWithSpanId, b: resultWithSpanId) =>
			a.stream.span_id.localeCompare(b.stream.span_id),
	);

	for (let i = 0; i < logs.length; i++) {
		const givenLog = sortedGiven[i];
		const receivedLog = sortedReceived[i];

		// We need to distinguish between label keys and arbitrary ones, since these are handled by loki differently.
		const givenAttrs = {};
		for (const key of Object.keys(givenLog)) {
			switch (key) {
				case LogKey.SeverityText:
				case LogKey.SeverityNumber:
				case LogKey.ServiceName:
				case LogKey.ServiceVersion:
				case LogKey.SpanId:
				case LogKey.TraceId:
				case LogKey.TimestampUnixNano:
					break;
				default:
					givenAttrs[key] = givenLog[key];
			}
		}

		expect(receivedLog.stream).toBeDefined();
		// We don't know what this value will be, so just check to see if it's there and then remove it.
		expect(receivedLog.stream.observed_timestamp).toBeDefined();
		receivedLog.stream.observed_timestamp = undefined;

		// We could compare these one by one but this will print the full stream value if the check fails.
		expect(receivedLog.stream).toEqual({
			observed_timestamp: receivedLog.observed_timestamp,
			scope_name: PACKAGE_NAME,
			scope_version: BUILD_VERSION,
			detected_level: givenLog[LogKey.SeverityText],
			service_name: givenLog[LogKey.ServiceName],
			service_version: givenLog[LogKey.ServiceVersion],
			severity_text: givenLog[LogKey.SeverityText],
			severity_number: givenLog[LogKey.SeverityNumber]?.toString(),
			span_id: givenLog[LogKey.SpanId]?.toLowerCase(),
			trace_id: givenLog[LogKey.TraceId]?.toLowerCase(),
		});

		expect(receivedLog.values).toBeArrayOfSize(1);
		expect(receivedLog.values[0]).toBeArrayOfSize(2);
		expect(receivedLog.values[0][0]).toEqual(
			givenLog[LogKey.TimestampUnixNano]?.toString(),
		);

		/**
		 * The body of the log from Loki's perspective is stored as a string.
		 * There's no guarantees on the order of items in the object, so we'll parse and compare.
		 */
		const receivedAttrs = JSON.parse(receivedLog.values[0][1]);
		expect(givenAttrs).toEqual(receivedAttrs);
	}
}

describe("unit-OtelJsonHttpLogExporter", async () => {
	it("can start and stop", async () => {
		const ctx = new Context();
		const inputQueue = new LocalQueue();
		const exporter = new OtelJsonHttpLogExporter({
			batchSize: 1,
			fullBatchTimeout: 1000,
			receiveTimeout: 1000,
			softStop: false,
			queue: inputQueue,
			endpoint: new URL("http://idontexist.local:3100"),
			consoleLogger: consoleLogger,
		});

		const exportPromise = exporter.export(ctx);
		ctx.cancel();
		await exportPromise;
	});

	it("can start and soft stop", async () => {
		const ctx = new Context();
		const inputQueue = new LocalQueue();
		const exporter = new OtelJsonHttpLogExporter({
			batchSize: 1,
			fullBatchTimeout: 1000,
			receiveTimeout: 1000,
			softStop: true,
			queue: inputQueue,
			endpoint: new URL("http://idontexist.local:3100"),
			consoleLogger: consoleLogger,
		});

		const exportPromise = exporter.export(ctx);
		ctx.cancel();
		await exportPromise;
	});

	it("ignores errors while pushing logs", async () => {
		const ctx = new Context();
		const inputQueue = new LocalQueue();
		const exporter = new OtelJsonHttpLogExporter({
			batchSize: 1,
			fullBatchTimeout: 1000,
			receiveTimeout: 1000,
			softStop: false,
			queue: inputQueue,
			endpoint: new URL("http://idontexist.local:3100"),
			consoleLogger: consoleLogger,
		});

		const exportPromise = exporter.export(ctx);
		await inputQueue.send(newRandomLog());
		ctx.cancel();
		await exportPromise;
	});
});

describe("func-OtelJsonHttpLogExporter", async () => {
	const compose = new ComposeHandler({
		composeFile: path.join(ComposeDirectoryPath, "otel", "docker-compose.yaml"),
		testName: "func-OtelJsonHttpLogExporter",
	});

	beforeAll(async () => {
		await compose.precheck();
	});

	beforeEach(async () => {
		console.log(`Faker seed: ${faker.seed()}`);
		await compose.up("loki");
	});

	afterEach(async () => {
		await compose.saveLogs("loki", "minio");
		await compose.down();
	});

	async function testExport(
		batchSize: number,
		numberOfLogs: number,
		addReceiveDelay: boolean,
	) {
		const ctx = new Context();
		const inputQueue = addReceiveDelay
			? new LocalQueueWithArtificialDelay(500, 1000)
			: new LocalQueue();
		const exporter = new OtelJsonHttpLogExporter({
			batchSize: batchSize,
			fullBatchTimeout: 2000,
			receiveTimeout: 1500, // For these tests, must be greater than maxDelay in LocalQueueWithArtificialDelay above.
			/**
			 * Use soft stop behavior so we don't have to rely on
			 * spying and other timeouts to wait for all logs to be exported.
			 */
			softStop: true,
			queue: inputQueue,
			endpoint: new URL("http://localhost:3100/otlp/v1/logs"),
			consoleLogger: consoleLogger,
		});

		const exportPromise = exporter.export(ctx);

		const testLogs = faker.helpers.uniqueArray(newRandomLog, numberOfLogs);
		for (const testLog of testLogs) {
			await inputQueue.send(testLog);
		}

		ctx.cancel();
		await exportPromise;
		await checkLokiForLogs(testLogs);
	}

	it("can export logs to loki with small batch", async () => {
		await testExport(1, 5, false);
	});

	it("can export logs to loki with medium batch", async () => {
		await testExport(10, 50, false);
	});

	it("can export logs to loki with large batch", async () => {
		await testExport(50, 500, false);
	});

	it("can export logs to loki with batch size greater than num logs", async () => {
		await testExport(5, 3, false);
	});

	/**
	 * These tests can take a really long time depending on the randomness of the injected delay.
	 * As a result, we limit this to a relatively smaller set of logs.
	 */
	it("can export small batch of logs to loki with artificial receive delay", async () => {
		await testExport(1, 5, true);
	});

	it("can export medium batch of logs to loki with artificial receive delay", async () => {
		await testExport(3, 15, true);
	});

	it("can export large batch of logs to loki with artificial receive delay", async () => {
		await testExport(10, 30, true);
	});

	it("can export logs to loki with batch size greater than num logs and artificial receive delay", async () => {
		await testExport(5, 3, true);
	});
});
