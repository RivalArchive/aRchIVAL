#!/usr/bin/env bun
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
import { writeFileSync } from "node:fs";
import puppeteer from "puppeteer";

async function staticify(url: string, file: string) {
	console.log("Launching browser");
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.setUserAgent(
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
	);
	await page.setViewport({ width: 1920, height: 1080 });

	console.log(`Navigating to ${url}`);
	await page.goto(url);
	await page.waitForNetworkIdle();

	console.log("Removing script tags");
	await page.evaluate(() => {
		const scripts = document.querySelectorAll("script");
		for (let i = 0; i < scripts.length; i++) {
			scripts[i].parentNode?.removeChild(scripts[i]);
		}
	});

	console.log("Rewriting relative links");
	const origin = new URL(url).origin;
	await page.evaluate((origin) => {
		const aTags = document.querySelectorAll("a");
		for (let i = 0; i < aTags.length; i++) {
			const href = aTags[i].getAttribute("href");
			if (href?.startsWith("/")) {
				aTags[i].setAttribute("href", `https://${origin}${href}`);
			}
		}
	}, origin);

	console.log(`Writing to ${file}`);
	const content = await page.content();
	writeFileSync(file, content);

	await browser.close();
}

(async () => {
	const usage = "usage: staticify url output-file";
	const url = process.argv.at(2);
	const outputFile = process.argv.at(3);
	if (url === undefined || outputFile === undefined) {
		console.log(usage);
		process.exit(1);
	}

	await staticify(url, outputFile);
})();
