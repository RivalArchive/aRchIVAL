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
import type { SimpleError } from "@archival/core/error";
import type { JsonValue } from "core/src/jsont";

/**
 * Define preset keys for log objects.
 */
export enum LogKey {
	/**
	 * The actual log message.
	 *
	 * @remarks
	 * This does not correspond to an OTEL field, due to the way the OTEL log data model is structured. OTEL has a concept of a
	 * log's "body", which is required and may be structured or unstructured, and a log's "attributes", which is optional and
	 * must be structured. One approach would be to define a "Body" LogKey, which maps to OTEL's "body" field , and move
	 * all other key/value pairs contained in a log to OTEL's "attributes" field. However, this is extra work, so we're
	 * going to define an archival-specific message field and then use the "body" OTEL field to store the entire log
	 * message.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-body
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-body
	 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/logs/v1/logs.proto#L136
	 */
	Message = "message",

	/**
	 * The ID of the associated trace.
	 *
	 * @remarks
	 * In an OTEL context, this corresponds to the "TraceId" field.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid
	 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/examples/logs.json
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/logs/v1/logs.proto#L136
	 */
	TraceId = "traceId",

	/**
	 * The ID of the associated span.
	 *
	 * @remarks
	 * In an OTEL context, this corresponds to the "SpanId" field.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-spanid
	 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/examples/logs.json
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/d7770822d70c7bd47a6891fc9faacc66fc4af3d3/opentelemetry/proto/logs/v1/logs.proto#L136
	 */
	SpanId = "spanId",

	/**
	 * The name of the severity of the log message.
	 *
	 * @remarks
	 * OTEL leaves this up to the "source", so we can define this however we want.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitytext
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/examples/logs.json
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitytext
	 */
	SeverityText = "severityText",

	/**
	 * The numerical ID of the severity of the log message.
	 *
	 * @remarks
	 * Only a subset of the values from the OTEL spec are available in {@link LogValue}, as archival only uses said subset.
	 * The idea here is to keep the set of available logging levels as small as possible so developers don't have to
	 * spend time debating or thinking about what level a log should be at.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/examples/logs.json
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
	 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
	 */
	SeverityNumber = "severityNumber",

	/**
	 * The unix nano timestamp when the log was created.
	 *
	 * @remarks
	 * In an OTEL context, this corresponds to the "timestamp" field in the documentation and the "timeUnixNano" field in
	 * the underlying protobuf definition.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-timestamp
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/examples/logs.json
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
	 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
	 */
	TimestampUnixNano = "timeUnixNano",

	/**
	 * Indicate the name of the service which generated the log message.
	 *
	 * @see {@link opentelemetry/semantic-conventions@ATTR_SERVICE_NAME}
	 */
	ServiceName = "service.name",

	/**
	 * Indicate the version of the service which generated the log message.
	 *
	 * @see {@link opentelemetry/semantic-conventions@ATTR_SERVICE_VERSION}
	 */
	ServiceVersion = "service.version",

	/**
	 * Error associated with the log, typically sourced from a catch block.
	 *
	 * @remarks
	 * OTEL defines a couple of error attributes, such as `error.type` and `error.message`, but we've chosen to deviate
	 * from these conventions to simplify the DX with adding errors into logs. Instead, users are expected to use
	 * {@link @archival/core/error#SimpleError | SimpleError} as a value here, which is JSON-serializable.
	 */
	Error = "error",

	/**
	 * Any Url that acts as relevant context.
	 *
	 * @see {@link opentelemetry/semantic-conventions#ATTR_URL_FULL}
	 */
	Url = "url.full",

	/**
	 * Define the component which is emitting the log, such as the class.
	 *
	 * Archival uses a OOP-ish style, meaning this key can be used to define the reusable component
	 * which is the source of the log.
	 *
	 * @remarks
	 * Follows the naming style of {@link opentelemetry/semantic-conventions#ATTR_CODE_FUNCTION_NAME}, but
	 * this is a non-standard attribute.
	 */
	CodeComponent = "code.component.name",

	/**
	 * For E2E tests, the name of the test being executed.
	 */
	TestName = "testName",

	/**
	 * For E2E tests, the ID of the test execution.
	 */
	TestId = "testId",

	/**
	 * Attach a DurableObject's alarm number to the log as a unix timestamp.
	 */
	DOAlarmTimestampUnixNano = "do.alarm",
}

/**
 * Define preset values for log objects.
 */
export enum LogValue {
	/**
	 * Value for {@link LogKey.SeverityText} which indicates the log is a debug log.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitytext
	 */
	SeverityTextDebug = "debug",

	/**
	 * Value for {@link LogKey.SeverityText} which indicates the log is a warning log.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitytext
	 */
	SeverityTextWarn = "warn",

	/**
	 * Value for {@link LogKey.SeverityText} which indicates the log is a fatal log.
	 *
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitytext
	 */
	SeverityTextFatal = "fatal",

	/**
	 * Value for {@link LogKey.SeverityNumber} which indicates the log is a debug log.
	 *
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
	 */
	SeverityNumberDebug = 5,

	/**
	 * Value for {@link LogKey.SeverityNumber} which indicates the log is a warning log.
	 *
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
	 */
	SeverityNumberWarn = 13,

	/**
	 * Value for {@link LogKey.SeverityNumber} which indicates the log is a fatal log.
	 *
	 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
	 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
	 */
	SeverityNumberFatal = 21,
}

/**
 * Define a standard set of keys and values to use within logs. These keys are reused throughout archival and
 * are here to ensure their names are consistent and their values are appropriate.
 *
 * Consumers of the logging library within archival can define their own Key/Value pairs, to allow for ad-hoc or one-off
 * pairs that may not appear everywhere. These keys and values are defined here specifically because they have certain
 * conventions or restrictions that must be respected.
 *
 * Note that it is up to developers to ensure that Values contain appropriate values. For example, there is no
 * enforcement to ensure that unix timestamps are in nanoseconds instead of seconds.
 *
 * Where applicable, these comply with values defined in the OTEL log data model and/or semantic conventions.
 * Otherwise they're whatever makes sense.
 *
 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#log-and-event-record-definition
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/examples/logs.json
 * @see https://github.com/open-telemetry/opentelemetry-proto/blob/v1.5.0/opentelemetry/proto/logs/v1/logs.proto
 * @see https://opentelemetry.io/docs/concepts/signals/logs/#log-record
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/v1.30.1/semantic-conventions
 */
export type Log = (
	| {
			[LogKey.SeverityText]?: LogValue.SeverityTextDebug;
			[LogKey.SeverityNumber]?: LogValue.SeverityNumberDebug;
	  }
	| {
			[LogKey.SeverityText]?: LogValue.SeverityTextWarn;
			[LogKey.SeverityNumber]?: LogValue.SeverityNumberWarn;
	  }
	| {
			[LogKey.SeverityText]?: LogValue.SeverityTextFatal;
			[LogKey.SeverityNumber]?: LogValue.SeverityNumberFatal;
	  }
) & {
	[LogKey.ServiceName]?: string;
	[LogKey.ServiceVersion]?: string;
	[LogKey.Message]?: string;
	[LogKey.TraceId]?: string;
	[LogKey.SpanId]?: string;
	[LogKey.TimestampUnixNano]?: number;
	[LogKey.Error]?: SimpleError;
	[LogKey.Url]?: string;
	[LogKey.CodeComponent]?: string;
	[LogKey.TestName]?: string;
	[LogKey.TestId]?: string;
	[LogKey.DOAlarmTimestampUnixNano]?: number;
	[key: string]: JsonValue;
};
