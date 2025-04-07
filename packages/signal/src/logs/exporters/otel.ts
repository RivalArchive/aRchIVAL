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
import { Context, ContextCancelledError } from "@archival/core/context";
import {
	newSimpleBug,
	newSimpleError,
	simplifyError,
} from "@archival/core/error";
import type { JsonObject, JsonValue } from "@archival/core/jsont";
import type { Result } from "@archival/core/result";
import type { Queue } from "@archival/queue";
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
import { FetchError, ofetch } from "ofetch";

import { BUILD_VERSION, PACKAGE_NAME } from "../../build";
import { type StructuredLogFunction, withProperties } from "../fns";
import { type Log, LogKey, LogValue } from "../kvs";

type _AnyValueBase =
	| { stringValue: string }
	| { boolValue: boolean }
	| { intValue: number }
	| { doubleValue: number };

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.common.v1.AnyValue` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/common/v1/common.proto#L28
 * @see https://zod.dev/?id=recursive-types
 */
type AnyValue =
	| _AnyValueBase
	// ArrayValue
	| { arrayValue: { values: AnyValue[] } }
	// KeyValueList
	| { kvlistValue: { values: { key: string; value: AnyValue }[] } };

function toAnyValue(v: JsonValue): Result<AnyValue> {
	switch (typeof v) {
		case "string":
			return { ok: { stringValue: v } };
		case "boolean":
			return { ok: { boolValue: v } };
		case "number":
			if (Number.isInteger(v)) {
				return { ok: { intValue: v } };
			}
			return { ok: { doubleValue: v } };
		case "object": {
			if (Array.isArray(v)) {
				const values: AnyValue[] = [];
				for (const value of v) {
					const result = toAnyValue(value);
					if (result.err !== undefined) {
						return {
							err: newSimpleError("unable to convert value in array", {
								context: {
									array: v,
									value: value,
									cause: simplifyError(result.err),
								},
							}),
						};
					}
					values.push(result.ok);
				}
				return {
					ok: { arrayValue: { values: values } },
				};
			}

			const vAsObj: JsonObject = v as JsonObject;
			const kvs: { key: string; value: AnyValue }[] = [];
			for (const key of Object.keys(vAsObj)) {
				const value = vAsObj[key];
				const result = toAnyValue(vAsObj[key]);
				if (result.err !== undefined) {
					return {
						err: newSimpleError("unable to convert value to kvlist", {
							context: {
								obj: v,
								key: key,
								value: value,
								cause: simplifyError(result.err),
							},
						}),
					};
				}
				kvs.push({ key: key, value: result.ok });
			}

			return { ok: { kvlistValue: { values: kvs } } };
		}
		default:
			return {
				err: newSimpleBug("unable to convert to AnyType, known type", {
					context: {
						typeof: typeof v,
						given: v,
					},
				}),
			};
	}
}

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.common.v1.KeyValue` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/common/v1/common.proto#L64
 */
type KeyValue = { key: string; value: AnyValue };

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.common.v1.InstrumentationScope` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/common/v1/common.proto#L71
 */
type InstrumentationScope = {
	name: string;
	version: string;
	attributes?: KeyValue[];
	droppedAttributesCount?: number;
};

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.logs.v1.LogRecord` object.
 *
 * The following optional fields are removed, as a use case for them in archival is not present yet and they are
 * optional:
 *
 *   - flags
 *   - eventName
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/logs/v1/logs.proto#L136
 */
type LogRecord = {
	timeUnixNano?: number;
	observedTimeUnixNano?: number;
	severityNumber?:
		| LogValue.SeverityNumberDebug
		| LogValue.SeverityNumberWarn
		| LogValue.SeverityNumberFatal;
	severityText?:
		| LogValue.SeverityTextDebug
		| LogValue.SeverityTextWarn
		| LogValue.SeverityTextFatal;
	body?: AnyValue;
	attributes?: KeyValue[];
	droppedAttributesCount?: number;
	traceId?: string;
	spanId?: string;
};

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.logs.v1.ScopeLogs` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/logs/v1/logs.proto#L68
 */
type ScopeLogs = {
	scope: InstrumentationScope;
	logRecords: LogRecord[];
	schemaUrl: "https://opentelemetry.io/schemas/1.30.0";
};

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.common.v1.Resource` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/2bd940b2b77c1ab57c27166af21384906da7bb2b/opentelemetry/proto/resource/v1/resource.proto#L28
 */
type Resource = {
	attributes: KeyValue[];
	droppedAttributesCount?: number;
};
/**
 * Type representation for a JSON-encoded `opentelemetry.proto.logs.v1.ResourceLogs` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/logs/v1/logs.proto#L48
 */
type ResourceLogs = {
	resource: Resource;
	scopeLogs: ScopeLogs[];
	schemaUrl: "https://opentelemetry.io/schemas/1.30.0";
};

/**
 * Type representation for a JSON-encoded
 * `opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest` object, which
 * is used as the body of a JSON HTTP POST request carrying log data to an OTEL endpoint.
 *
 * @see https://opentelemetry.io/docs/specs/otlp/#otlphttp-request
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/collector/logs/v1/logs_service.proto#L36
 */
type ExportLogsServiceRequest = {
	resourceLogs: ResourceLogs[];
};

/**
 * Type representation for a JSON-encoded `opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess` object.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/collector/logs/v1/logs_service.proto#L64
 */
type ExportLogsPartialSuccess = {
	rejectedLogsRecords: number;
	errorMessage: string;
};

/**
 * Type representation for a JSON-encoded
 * `opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse` object, which
 * is used to verify the response body of a JSON HTTP POST request carrying log data to an
 * OTEL endpoint.
 *
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/collector/logs/v1/logs_service.proto#L45
 */
type ExportLogsServiceResponse = {
	partialSuccess?: ExportLogsPartialSuccess;
};

/**
 * Convert series of {@link @archival/signal/logs/Log} objects into a series of {@link ExportLogsServiceRequest}.
 *
 * Log objects are flat in nature, but the request isn't. Certain key/value pairs inside of the log will be mapped to
 * different fields within the request:
 *
 *   1. {@link @archival/signal/logs/LogKey.ServiceName}, {@link @archival/signal/logs/LogKey.ServiceVersion} are mapped
 *      to {@link Resource.attributes}.
 *   2. {@link @archival/signal/logs/LogKey.TimestampUnixNano}, {@link @archival/signal/logs/LogKey.SeverityNumber},
 *      {@link @archival/signal/logs/LogKey.SeverityText}, {@link @archival/signal/logs/LogKey/TraceId}, and
 *      {@link @archival/signal/logs/LogKey.SpanId} map to their respective attributes of {@link LogRecord}.
 *   3. Everything else is put into LogRecord.body.
 *
 * Logs are grouped based on their request-level attributes. Scope metadata is automatically injected.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/resource/
 */
function logsToExportRequest(
	localLogFn: StructuredLogFunction,
	...logs: Log[]
): ExportLogsServiceRequest {
	const requestsByResource: {
		// ServiceName + ServiceVersion.
		[key: string]: LogRecord[];
	} = {};

	for (const log of logs) {
		const serviceName: string = log[LogKey.ServiceName] ?? "unknown";
		const serviceVersion: string =
			log[LogKey.ServiceVersion] ?? "0.0.0-unknown";
		const resourceKey = `${serviceName}\n${serviceVersion}`;

		if (requestsByResource[resourceKey] === undefined) {
			requestsByResource[resourceKey] = [];
		}

		const record: LogRecord = {
			timeUnixNano: log[LogKey.TimestampUnixNano],
			severityNumber: log[LogKey.SeverityNumber],
			severityText: log[LogKey.SeverityText],
			traceId: log[LogKey.TraceId],
			spanId: log[LogKey.SpanId],
			observedTimeUnixNano: Date.now() * 1_000_000,
		};

		let droppedAttributesCount = 0;
		const body: AnyValue = { kvlistValue: { values: [] } };
		for (const key in log) {
			switch (key) {
				case LogKey.TimestampUnixNano:
				case LogKey.SeverityNumber:
				case LogKey.SeverityText:
				case LogKey.TraceId:
				case LogKey.SpanId:
				case LogKey.ServiceName:
				case LogKey.ServiceVersion:
					continue;
				default: {
					const value = log[key];
					const result = toAnyValue(value);
					if (result.err !== undefined) {
						droppedAttributesCount += 1;
						localLogFn({
							[LogKey.SeverityText]: LogValue.SeverityTextFatal,
							[LogKey.SeverityNumber]: LogValue.SeverityNumberFatal,
							[LogKey.Message]: "Unable to export attribute in log",
							givenLog: log,
							key: key,
							value: value,
							[LogKey.Error]: result.err,
						});
						continue;
					}
					body.kvlistValue.values.push({ key: key, value: result.ok });
				}
			}
		}

		record.droppedAttributesCount = droppedAttributesCount;
		record.body = body;

		requestsByResource[resourceKey].push(record);
	}

	const request: ExportLogsServiceRequest = { resourceLogs: [] };
	for (const key of Object.keys(requestsByResource)) {
		const records = requestsByResource[key];
		if (records.length === 0) {
			continue;
		}

		const [serviceName, serviceVersion] = key.split("\n", 2);

		const resourceLog: ResourceLogs = {
			schemaUrl: "https://opentelemetry.io/schemas/1.30.0",
			resource: {
				attributes: [
					{
						key: "service.name",
						value: {
							stringValue: serviceName,
						},
					},
					{
						key: "service.version",
						value: {
							stringValue: serviceVersion,
						},
					},
				],
			},
			scopeLogs: [
				{
					schemaUrl: "https://opentelemetry.io/schemas/1.30.0",
					scope: {
						name: PACKAGE_NAME,
						version: BUILD_VERSION,
					},
					logRecords: records,
				},
			],
		};

		request.resourceLogs.push(resourceLog);
	}

	return request;
}

const ErrorNameOtelExportLogsServicePartialSuccess =
	"OtelExportLogsServicePartialSuccess";

/**
 * Options for the {@link OtelJsonHttpLogExporter} constructor.
 */
export type OtelJsonHttpLogExporterOptions = {
	/**
	 * Queue to pull log messages from.
	 */
	queue: Queue;

	/**
	 * The OTEL HTTP endpoint to push logs to. Must include the target path. The OTEL spec defines the default as
	 * `/v1/logs`.
	 */
	endpoint: URL;

	/**
	 * For visibility into errors which may occur while exporting logs, provide a console logger that can log messages
	 * locally.
	 */
	consoleLogger: StructuredLogFunction;

	/**
	 * The number of logs to batch together before making a request to the OTEL endpoint.
	 */
	batchSize: number;

	/**
	 * The maximum number of milliseconds to wait for a full batch before exporting. If a full batch has not been
	 * obtained prior to this timeout expiring, the batch is sent anyways.
	 */
	fullBatchTimeout: number;

	/**
	 * The number of milliseconds to wait for a new item from the queue.
	 *
	 * This interrupt allows for the exporter not to block forever and give it a chance to check if the provided
	 * {@link @archival/core/context/Context} has been cancelled.
	 */
	receiveTimeout: number;

	/**
	 * If true, the exporter will try to consume all items from the given queue before exiting after the given
	 * {@link @archival/core/context/Context} has been cancelled.
	 *
	 * The queue is considered empty if a new item hasn't been received in `receiveTimeout` milliseconds.
	 */
	softStop: boolean;
};

/**
 * Export logs to an OTEL JSON HTTP endpoint.
 *
 * @remarks
 * The JSON format may not be as efficient as the binary protobuf format, but I really don't want to deal with code
 * generation. For now, JSON is good enough.
 *
 * We're implementing this ourselves, rather than consuming the SDK, because the log-portion of the SDK is still in
 * development. It's simple enough to define ourselves and will save us work down the line from having to debug issues
 * that may arise from the SDK's instability. Using the SDK for logs isn't even documented, as of March 27th, 2025.
 *
 * @see https://opentelemetry.io/docs/specs/otlp/#otlphttp-request
 * @see https://opentelemetry.io/docs/languages/js/instrumentation/#logs
 */
export class OtelJsonHttpLogExporter {
	#queue: Queue;
	#endpoint: URL;
	#batchSize: number;
	#fullBatchTimeout: number;
	#receiveTimeout: number;
	#softStop: boolean;
	#logger: StructuredLogFunction;

	constructor(options: OtelJsonHttpLogExporterOptions) {
		this.#queue = options.queue;
		this.#endpoint = options.endpoint;
		this.#batchSize = options.batchSize;
		this.#fullBatchTimeout = options.fullBatchTimeout;
		this.#receiveTimeout = options.receiveTimeout;
		this.#softStop = options.softStop;

		this.#logger = withProperties(
			{
				[LogKey.CodeComponent]: "OtelJsonHttpLogExporter",
				otelEndpoint: options.endpoint.toString(),
				maxBatchSize: options.batchSize,
				fullBatchTimeoutMilliseconds: options.fullBatchTimeout,
				receiveTimeoutMilliseconds: options.receiveTimeout,
				softStop: options.softStop,
			},
			options.consoleLogger,
		);
	}

	async #exportBatch(batch: Log[]): Promise<undefined> {
		const request = logsToExportRequest(this.#logger, ...batch);

		this.#logger({
			[LogKey.SeverityNumber]: LogValue.SeverityNumberDebug,
			[LogKey.SeverityText]: LogValue.SeverityTextDebug,
			[LogKey.Message]: "sending batch of logs to otel endpoint",
			batchSize: batch.length,
			request: request,
		});

		let response: ExportLogsServiceResponse;
		try {
			response = await ofetch<ExportLogsServiceResponse>(
				this.#endpoint.toString(),
				{
					body: request,
					method: "POST",
				},
			);
		} catch (e: unknown) {
			if (!(e instanceof FetchError)) {
				this.#logger({
					[LogKey.SeverityNumber]: LogValue.SeverityNumberFatal,
					[LogKey.SeverityText]: LogValue.SeverityTextFatal,
					[LogKey.Message]:
						"got unexpected error while sending otel log request",
					[LogKey.Error]: simplifyError(e),
					request: request,
				});
				return;
			}

			this.#logger({
				[LogKey.SeverityNumber]: LogValue.SeverityNumberFatal,
				[LogKey.SeverityText]: LogValue.SeverityTextFatal,
				[LogKey.Message]: "unable to send otel log request",
				[LogKey.Error]: simplifyError(e),
				request: request,
				responseBody: e.data,
				responseCode: e.statusCode,
			});

			return;
		}

		if (response === undefined || response.partialSuccess === undefined) {
			this.#logger({
				[LogKey.SeverityNumber]: LogValue.SeverityNumberDebug,
				[LogKey.SeverityText]: LogValue.SeverityTextDebug,
				[LogKey.Message]: "received full success while exporting batch",
				request: request,
			});
		} else {
			// The server may either respond with rejected logs and an error or a warning.
			if (response.partialSuccess.rejectedLogsRecords > 0) {
				this.#logger({
					[LogKey.SeverityNumber]: LogValue.SeverityNumberFatal,
					[LogKey.SeverityText]: LogValue.SeverityTextFatal,
					[LogKey.Message]: "received partial success while exporting batch",
					[LogKey.Error]: newSimpleError(response.partialSuccess.errorMessage, {
						name: ErrorNameOtelExportLogsServicePartialSuccess,
					}),
					request: request,
					response: response,
				});
			} else {
				this.#logger({
					[LogKey.SeverityNumber]: LogValue.SeverityNumberWarn,
					[LogKey.SeverityText]: LogValue.SeverityTextWarn,
					[LogKey.Message]:
						"received warning from otel endpoint while exporting batch",
					[LogKey.Error]: newSimpleError(response.partialSuccess.errorMessage, {
						name: ErrorNameOtelExportLogsServicePartialSuccess,
					}),
					request: request,
					response: response,
				});
			}
		}
	}

	async export(ctx: Context): Promise<Result<undefined>> {
		let logResult: Result<JsonObject>;
		let batch: Log[] = [];
		let lastSendUnix: number = Date.now();

		/**
		 * This condition is a bit unintuitive at first, so here's how it works:
		 * If softStop is true, we only exit the while loop after a timeout on receive.
		 * If softStop is false, we can exit at any time after the context has been cancelled.
		 */
		while (this.#softStop || !ctx.done()) {
			if (
				batch.length >= this.#batchSize ||
				Date.now() - lastSendUnix > this.#fullBatchTimeout
			) {
				await this.#exportBatch(batch);
				lastSendUnix = Date.now();
				batch = [];
				continue; // continue here so we can check ctx.
			}

			/**
			 * We DO NOT use the given context as the parent if softStop is true, because
			 * we're trying to return only when the queue is considered empty. We need to timeout on
			 * receive. Otherwise if softStop is false, we want to return asap.
			 */
			const timeoutCtx = this.#softStop ? new Context() : new Context(ctx);
			setTimeout(() => timeoutCtx.cancel(), this.#receiveTimeout);

			logResult = await this.#queue.receive(timeoutCtx);
			if (logResult.err !== undefined) {
				if (logResult.err === ContextCancelledError) {
					/**
					 * We're either here due to a timeout or due to the parent context being cancelled, based
					 * on if softStop is true or not. In both cases we perform the same action, which is to
					 * break if the parent context is done and continue to the next iteration otherwise.
					 *
					 * If softStop is true then we're here due to a timeout on receive. The queue at this point
					 * is considered empty. If the parent context is cancelled then we can break.
					 * Otherwise, we continue to the next iteration so we can try receiving again and wait for
					 * new items in the queue.
					 *
					 * If softStop is false, then we're here either due to a receive timeout or the parent context
					 * being cancalled. If the parent context is done, we break. Otherwise, we continue to the next
					 * iteration and try pulling from the queue again.
					 */
					if (ctx.done()) {
						break;
					}

					continue;
				}
				const err = simplifyError(logResult.err);
				this.#logger({
					[LogKey.SeverityText]: LogValue.SeverityTextWarn,
					[LogKey.SeverityNumber]: LogValue.SeverityNumberWarn,
					[LogKey.Message]:
						"error occurred while receiving new item from the queue",
					[LogKey.Error]: err,
				});
				continue;
			}

			if (logResult.ok === undefined) {
				throw newSimpleBug(
					"expected message or an error, instead got neither",
					{ context: { received: logResult } },
				);
			}

			batch.push(logResult.ok);
		}

		// Export the final remaining logs before exiting.
		if (batch.length > 0) {
			await this.#exportBatch(batch);
		}

		this.#logger({
			[LogKey.SeverityText]: LogValue.SeverityTextDebug,
			[LogKey.SeverityNumber]: LogValue.SeverityNumberDebug,
			[LogKey.Message]: "stopping exporter, context cancelled",
			[LogKey.Error]: ContextCancelledError,
		});

		return { ok: undefined };
	}
}
