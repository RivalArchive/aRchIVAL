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

import { randomInt } from "node:crypto";
import { ContentType } from "@archival/core/content";
import {
	Check,
	type CheckHistory,
	ReasonBadTwitterStatusId,
	ReasonBadTwitterUsername,
	ReasonContainsDomainCreds,
	ReasonContainsFragment,
	ReasonContainsSearch,
	ReasonDomainNotTwitter,
	ReasonMustBeHttps,
	ReasonNotTwitterPostPath,
	ReasonParseFailed,
	ReasonPass,
	ReasonRequirementNotMet,
	ReasonSpecifiesPort,
	inspectUrl,
} from "../src/urls";

function checkReturnsDispatchable(
	url: string,
	contentType: ContentType,
	requiredChecks: Check[],
) {
	const result = inspectUrl(url);
	expect(result.contentType).toEqual(contentType);

	for (const check of requiredChecks) {
		const checkResult = result.checks[check];
		expect(checkResult).toBeDefined();
		if (checkResult === undefined) {
			throw "unreachable";
		}
		expect(checkResult.pass).toEqual(true);
		expect(checkResult.reason).toEqual(ReasonPass);
	}
}

function checkReturnsNotDispatchable(
	url: string,
	requiredHistory: CheckHistory,
) {
	const result = inspectUrl(url);
	expect(result.contentType).toBeUndefined();
	for (const checkName in requiredHistory) {
		const checkResult = result.checks[checkName];
		expect(checkResult).toBeDefined();
		if (checkResult === undefined) {
			throw "unreachable";
		}
		const expectedResult = requiredHistory[checkName];
		expect(checkResult).toEqual(expectedResult);
	}
}

const unacceptableProtocols: string[] = [
	"http",
	"rtsp",
	"https123",
	"file",
	"ftp",
	"something",
];

function generateNonHttpsUrl(): string {
	return `${faker.helpers.arrayElement(unacceptableProtocols)}://${faker.internet.domainName()}`;
}

function generateUrlWithCreds(): string {
	const username = faker.helpers.maybe(() => faker.internet.username());
	const password = faker.helpers.maybe(() => faker.internet.password());
	return `https://${username}:${password}@${faker.internet.domainName()}`;
}

function generateUrlWithNonHttpsPort(): string {
	let port = faker.internet.port();
	if (port === 443) {
		port += 1;
	}
	return `https://${faker.internet.domainName()}:${port}`;
}

function generateUrlWithHashFragment(): string {
	return `https://${faker.internet.domainName()}/#${faker.word.noun()}`;
}

function generateUrlWithQueryParams(): string {
	const len = randomInt(4) + 1;
	const paramString = faker.helpers
		.uniqueArray(() => `${faker.word.noun()}=${faker.word.verb()}`, len)
		.join("&");

	return `https://${faker.internet.domainName()}/?${paramString}`;
}

function generateGoodTwitterUsername(): string {
	return faker.string.fromCharacters(
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_",
		{ min: 4, max: 15 },
	);
}

function generateBadTwitterUsername(): string {
	// We want characters that won't mess up the URL but are still invalid usernames.
	return `${faker.string.fromCharacters("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_:-!*", { min: 0, max: 30 })}-`;
}

function generateTwitterPostUrlWithBadStatusId(): string {
	const badStatusId = faker.string.fromCharacters(
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
		{ min: 0, max: 30 },
	);
	return `https://x.com/${generateGoodTwitterUsername()}/status/${badStatusId})}`;
}

function generateTwitterPostUrlWithBadUsername(): string {
	return `https://x.com/${generateBadTwitterUsername()}/status/${faker.number.int()}`;
}

function generateGoodTwitterPostUrl(): string {
	return `https://x.com/${generateGoodTwitterUsername()}/status/${faker.number.int()}`;
}

const NUM_TEST_CASES = 50;

describe("inspectUrl base checks", () => {
	console.log(`inspectUrl base checks faker seed: ${faker.seed()}`);

	it.each(
		faker.helpers.uniqueArray(
			// Remove all colons, which might actually cause URL.parse to succeed.
			() => faker.string.sample({ min: 0, max: 100 }).replaceAll(":", ""),
			NUM_TEST_CASES,
		),
	)("fails '%s' since it isn't a url", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: false, reason: ReasonParseFailed },
		});
	});

	it.each(faker.helpers.uniqueArray(generateNonHttpsUrl, NUM_TEST_CASES))(
		"fails '%s' due to protocol that isn't https",
		(url) => {
			checkReturnsNotDispatchable(url, {
				[Check.IsAcceptable]: { pass: false, reason: ReasonMustBeHttps },
			});
		},
	);

	it.each(faker.helpers.uniqueArray(generateUrlWithCreds, NUM_TEST_CASES))(
		"fails '%s' since it contains a username or password",
		(url) => {
			checkReturnsNotDispatchable(url, {
				[Check.IsAcceptable]: {
					pass: false,
					reason: ReasonContainsDomainCreds,
				},
			});
		},
	);

	// For this test, "https://x.com:443" fails because the URL constructor transparently removes the port.
	it.each(
		faker.helpers.uniqueArray(generateUrlWithNonHttpsPort, NUM_TEST_CASES),
	)("fails '%s' since it contains a manually specified port", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: false, reason: ReasonSpecifiesPort },
		});
	});
});

describe("inspectUrl twitter checks", async () => {
	console.log(`inspectUrl twitter checks faker seed: ${faker.seed()}`);

	it.each(
		faker.helpers.uniqueArray(generateUrlWithHashFragment, NUM_TEST_CASES),
	)("fails '%s' since it contains a hash fragment", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: true, reason: ReasonPass },
			[Check.IsPlain]: { pass: false, reason: ReasonContainsFragment },
			[Check.IsTwitterPost]: { pass: false, reason: ReasonRequirementNotMet },
		});
	});

	it.each(
		faker.helpers.uniqueArray(generateUrlWithQueryParams, NUM_TEST_CASES),
	)("fails '%s' since it contains search parameters", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: true, reason: ReasonPass },
			[Check.IsPlain]: { pass: false, reason: ReasonContainsSearch },
			[Check.IsTwitterPost]: { pass: false, reason: ReasonRequirementNotMet },
		});
	});

	it.each(faker.helpers.uniqueArray(faker.internet.url, NUM_TEST_CASES))(
		"fails '%s' since the domain isn't twitter (x.com)",
		(url) => {
			checkReturnsNotDispatchable(url, {
				[Check.IsAcceptable]: { pass: true, reason: ReasonPass },
				[Check.IsPlain]: { pass: true, reason: ReasonPass },
				[Check.IsTwitterPost]: { pass: false, reason: ReasonDomainNotTwitter },
			});
		},
	);

	/**
	 * To check path validation, we're going to exercise known edge cases.
	 * Generating URLs with faker isn't too applicable here.
	 */
	it.each([
		"https://x.com",
		"https://x.com/",
		"https://x.com/myuser",
		"https://x.com/myuser/",
		"https://x.com/myuser/status",
		"https://x.com/myuser/status/",
		"https://x.com/myuser/status/1234/anotherone",
		"https://x.com/myuser/status/1234/anotherone/",
		"https://x.com/myuser/stats/1234",
		"https://x.com/myuser/stats/1234/",
		"https://x.com/myuser//1234",
		"https://x.com/myuser//1234/",
		"https://x.com/myuser/coolstatuspage/1234",
		"https://x.com/myuser/coolstatuspage/1234/",
		"https://x.com/extra/myuser/status/1234",
		"https://x.com/extra/myuser/status/1234/",
	])("fails '%s' due to invalid path", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: true, reason: ReasonPass },
			[Check.IsPlain]: { pass: true, reason: ReasonPass },
			[Check.IsTwitterPost]: { pass: false, reason: ReasonNotTwitterPostPath },
		});
	});

	it.each(
		faker.helpers.uniqueArray(
			generateTwitterPostUrlWithBadStatusId,
			NUM_TEST_CASES,
		),
	)("fails '%s' due to non-numeric status", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: true, reason: ReasonPass },
			[Check.IsPlain]: { pass: true, reason: ReasonPass },
			[Check.IsTwitterPost]: { pass: false, reason: ReasonBadTwitterStatusId },
		});
	});

	it.each(
		faker.helpers.uniqueArray(
			generateTwitterPostUrlWithBadUsername,
			NUM_TEST_CASES,
		),
	)("fails '%s' due to invalid character in username", (url) => {
		checkReturnsNotDispatchable(url, {
			[Check.IsAcceptable]: { pass: true, reason: ReasonPass },
			[Check.IsPlain]: { pass: true, reason: ReasonPass },
			[Check.IsTwitterPost]: { pass: false, reason: ReasonBadTwitterUsername },
		});
	});

	it.each(
		faker.helpers.uniqueArray(generateGoodTwitterPostUrl, NUM_TEST_CASES),
	)("passes '%s'", (url) => {
		checkReturnsDispatchable(url, ContentType.TwitterPost, [
			Check.IsAcceptable,
			Check.IsPlain,
			Check.IsTwitterPost,
		]);
	});
});
