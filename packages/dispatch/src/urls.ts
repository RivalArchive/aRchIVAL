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
import { ContentType } from "@archival/core/content";
import { newSimpleBug } from "@archival/core/error";

export type CheckResult = {
	pass: boolean;
	reason?: string;
};

export type CheckHistory = {
	[key: string]: CheckResult;
};

export enum Check {
	IsAcceptable = "isAcceptable",
	IsPlain = "isPlain",
	IsTwitterPost = "isTwitterPost",
}

function setCheckAndReturn(
	checkName: Check,
	pass: boolean,
	reason: string,
	checks: CheckHistory,
): boolean {
	checks[checkName] = { pass: pass, reason: reason };
	return pass;
}

export const ReasonPass = "pass";
export const ReasonParseFailed = "URL.canParse failed";
export const ReasonMustBeHttps = "url protocol must be https";
export const ReasonContainsDomainCreds =
	"url contains a username or password before the domain";
export const ReasonSpecifiesPort = "url manually specifies a port";

function isAcceptableUrl(
	urlRaw: string,
	checks: CheckHistory,
): URL | undefined {
	const fail = (reason: string): undefined => {
		checks[Check.IsAcceptable] = { pass: false, reason: reason };
		return undefined;
	};

	if (!URL.canParse(urlRaw)) {
		return fail(ReasonParseFailed);
	}

	const url = new URL(urlRaw);

	if (url.protocol !== "https:") {
		return fail(ReasonMustBeHttps);
	}

	if (url.username !== "" || url.password !== "") {
		return fail(ReasonContainsDomainCreds);
	}

	if (url.port !== "") {
		return fail(ReasonSpecifiesPort);
	}

	checks[Check.IsAcceptable] = { pass: true, reason: ReasonPass };
	return url;
}

function requiresChecks(
	checks: CheckHistory,
	requiredChecks: [Check, (checks: CheckHistory) => boolean][],
): boolean {
	for (const [checkName, checkFn] of requiredChecks) {
		let requiredCheck = checks[checkName];
		if (requiredCheck === undefined) {
			checkFn(checks);
			requiredCheck = checks[checkName];
			// Sanity check
			if (requiredCheck === undefined) {
				throw newSimpleBug(
					"url check function did not populate check history with expected name",
					{
						context: { expectedUrlCheck: [checkName], checkHistory: checks },
					},
				);
			}
		}
		if (!requiredCheck.pass) {
			return false;
		}
	}
	return true;
}

function requiresIsAcceptable(url: URL, checks: CheckHistory): boolean {
	return requiresChecks(checks, [
		[
			Check.IsAcceptable,
			(checks: CheckHistory) => isAcceptableUrl(url.href, checks) !== undefined,
		],
	]);
}

export const ReasonRequirementNotMet = "required url check did not pass";
export const ReasonContainsFragment = "url contains fragment identifier";
export const ReasonContainsSearch = "url contains search parameters";

function isPlain(url: URL, checks: CheckHistory): boolean {
	const fail = (reason: string) =>
		setCheckAndReturn(Check.IsPlain, false, reason, checks);

	const requirementsMet = requiresIsAcceptable(url, checks);
	if (!requirementsMet) {
		return fail(ReasonRequirementNotMet);
	}

	if (url.hash !== "") {
		return fail(ReasonContainsFragment);
	}

	if (url.search !== "") {
		return fail(ReasonContainsSearch);
	}

	return setCheckAndReturn(Check.IsPlain, true, ReasonPass, checks);
}

export const ReasonDomainNotTwitter = "url domain is not 'x.com'";
export const ReasonNotTwitterPostPath =
	"url path must be of the format '/{user}/status/{id}'";
export const ReasonBadTwitterStatusId =
	"status id in url contains an invalid character";
export const ReasonBadTwitterUsername =
	"username in url contains an invalid character";

function isTwitterPost(url: URL, checks: CheckHistory): boolean {
	const fail = (reason: string) =>
		setCheckAndReturn(Check.IsTwitterPost, false, reason, checks);

	const requiredChecks =
		requiresChecks(checks, [
			[Check.IsPlain, (checks) => isPlain(url, checks)],
		]) && requiresIsAcceptable(url, checks);
	if (!requiredChecks) {
		return fail(ReasonRequirementNotMet);
	}

	// We're looking for a URL that looks like this:
	// https://x.com/{user}/status/{id}
	if (url.hostname !== "x.com") {
		return fail(ReasonDomainNotTwitter);
	}

	// The "pathname" property of a URL always starts with a forward-slash, so when we split
	// on it we should get four parts.
	const pathParts = url.pathname.split("/");
	if (pathParts.length !== 4) {
		return fail(ReasonNotTwitterPostPath);
	}

	// Since the path starts with a forward slash, the first item in the parts list
	// should just be an empty string.
	if (pathParts[0] !== "") {
		return fail(ReasonNotTwitterPostPath);
	}

	// These next checks are performed from least expensive to most expensive.
	if (pathParts[2] !== "status") {
		return fail(ReasonNotTwitterPostPath);
	}

	// If the URL doesn't contain a status ID and ends in a forward-slash, the
	// statusID here will be empty; filter out https://x.com/{user}/status/.
	const statusID = pathParts[3];
	if (statusID === "") {
		return fail(ReasonNotTwitterPostPath);
	}

	for (let i = 0; i < statusID.length; i++) {
		// The status ID can only be a string of digits.
		const charValue = statusID.charCodeAt(i);
		if (!(48 <= charValue && 57 >= charValue)) {
			return fail(ReasonBadTwitterStatusId);
		}
	}

	const username = pathParts[1];
	for (let i = 0; i < username.length; i++) {
		// Twitter usernames can contain ascii letters, digits, or underscores.
		const charValue = username.charCodeAt(i);
		if (
			!(
				// NOT
				// Uppercase letters (A-Z): [65, 90]
				(
					(65 <= charValue && 90 >= charValue) ||
					// Lowercase letters (a-z): [97, 122]
					(97 <= charValue && 122 >= charValue) ||
					// Digits (0-9): [48, 57]
					(48 <= charValue && 57 >= charValue) ||
					// Underscore (_): 95
					95 === charValue
				)
			)
		) {
			return fail(ReasonBadTwitterUsername);
		}
	}

	return setCheckAndReturn(Check.IsTwitterPost, true, ReasonPass, checks);
}

type UrlCheckFn = (url: URL, checks: CheckHistory) => boolean;

const contentChecks: [ContentType, UrlCheckFn][] = [
	[ContentType.TwitterPost, isTwitterPost],
];

export type InspectUrlResult = {
	checks: CheckHistory;
	contentType?: ContentType;
};

export function inspectUrl(urlRaw: string): InspectUrlResult {
	const checks: CheckHistory = {};

	// First check if the URL is even legit.
	const url = isAcceptableUrl(urlRaw, checks);
	if (url === undefined) {
		return {
			checks: checks,
		};
	}

	for (const [contentType, checkFn] of contentChecks) {
		const isContentType = checkFn(url, checks);
		if (isContentType) {
			return {
				checks: checks,
				contentType: contentType,
			};
		}
	}

	return {
		checks: checks,
	};
}
