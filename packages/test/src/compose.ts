import fs from "node:fs";
import path from "node:path";
import { faker } from "@faker-js/faker";
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
import { $, type ShellError, type ShellExpression, fileURLToPath } from "bun";

/**
 * Default compose command. Set to either the `COMPOSE_COMMAND` environment variable or,
 * if it doesn't exist, `podman compose`.
 */
export const DefaultComposeCommand =
	process.env.COMPOSE_COMMAND ?? "podman compose";

export const ComposeDirectoryPath = path.join(
	fileURLToPath(import.meta.url),
	"../../../../compose",
);

export type ComposeHandlerOpts = {
	/**
	 * Name of the test using the compose handler.
	 */
	testName: string;

	/**
	 * Top-level compose command, such as "podman compose" or "docker compose".
	 */
	composeCommand?: string;

	/**
	 * Compose file to interact with.
	 */
	composeFile?: string;
};

/**
 * Small wrapper to interact with docker-compose or podman-compose via the bun shell.
 */
export class ComposeHandler {
	#composeCommand: string;
	#composeFile: string;
	#id: string;
	#testName: string;
	#prefix: string[];
	#cmd: string;

	constructor(opts: ComposeHandlerOpts) {
		this.#composeCommand = opts.composeCommand ?? DefaultComposeCommand;
		this.#composeFile = opts.composeFile ?? "./compose.yaml";
		this.#testName = opts.testName;
		this.#id = `${this.#testName}-${faker.string.nanoid(8)}`;
		const prefix =
			`${this.#composeCommand} -p ${this.#id} -f ${this.#composeFile}`.split(
				" ",
			);
		this.#cmd = prefix[0];
		this.#prefix = prefix.slice(1);
	}

	/**
	 * Performs checks to ensure everything is ready to go. Throws an error if
	 * something is wrong.
	 */
	async precheck() {
		/**
		 * We have to split on spaces here. If the command contains a space (ie "podman compose"), bun will
		 * interpret the entire string as the command and return "command not found: podman compose".
		 */
		await $`${this.#composeCommand.split(" ")} version`;

		if (!fs.existsSync(this.#composeFile)) {
			throw new Error(`unable to find compose file: ${this.#composeFile}`);
		}
	}

	/**
	 * Prints the given command described by the provided template literal, with special handling
	 * for joining array values with spaces.
	 */
	#printCommand(
		strings: TemplateStringsArray,
		...expressions: ShellExpression[]
	): string {
		return ` + ${strings.reduce(
			(
				previous: string,
				current: string,
				idx: number,
				_: readonly string[],
			): string => {
				const nextExpression: ShellExpression = expressions[idx] ?? "";
				let toAdd = "";
				if (Array.isArray(nextExpression)) {
					toAdd = nextExpression.join(" ");
				} else {
					toAdd = nextExpression.toString();
				}

				return previous + current + toAdd;
			},
			"",
		)}`;
	}

	/**
	 * Wraps Bun's shell command. Prints the given command to the console, returns the command's output as a string,
	 * and prints stdout and stderr to the console on command failure before throwing again.
	 *
	 * @remarks
	 * This used to be a "normal" function which accepted a string which represented a sub-command to be passed to the
	 * invocation of Bun's shell but Bun has very strict guards around expressions for template literals which limit our
	 * flexibility.
	 *
	 * When the Bun shell interprets a template literal, it handles substituted expressions in a very safe manner,
	 * so we can't do things like:
	 *
	 *   ```typescript
	 *   const command = "podman compose";
	 *   await $`${command}`;
	 *   ```
	 *
	 * Or:
	 *
	 *   ```typescript
	 *   const subCommand = "logs > logs.log";
	 *   await $`podman compose ${subCommand}`;
	 *   ```
	 *
	 * In this first example, bun attempts to execute the command "podman compose", rather than the command "podman"
	 * with the argument "compose". In the second example, bun provides "logs > logs.log" as arguments to "podman compose"
	 * rather than providing "logs" and piping the output to "logs.log".
	 *
	 *
	 * Instead, we'll forward the provided input to bun's shell as was constructed in the caller. This lets us stay safe
	 * by leveraging Bun's safety, while being able to still reduce code-reuse.
	 *
	 * @returns stdout captured from the command.
	 */
	async #run(strings: TemplateStringsArray, ...expressions: ShellExpression[]) {
		console.log(this.#printCommand(strings, ...expressions));
		try {
			const result = await $(strings, ...expressions);
			return result.text();
		} catch (e: unknown) {
			if (
				typeof e === "object" &&
				e != null &&
				Object.hasOwn(e, "name") &&
				(e as Error).name === "ShellError"
			) {
				const shellError = e as ShellError;
				console.log(shellError.stdout.toString());
				console.log(shellError.stderr.toString());
			}
			throw e;
		}
	}

	/**
	 * Helper method for starting services. Ensures that services are recreated if they already
	 * exist and they are started in the background.
	 */
	async up(...services: string[]) {
		return this.#run`${this.#cmd} ${this.#prefix} up -d ${services}`;
	}

	/**
	 * Helper method for stopping services.
	 */
	async down(...services: string[]) {
		return this.#run`${this.#cmd} ${this.#prefix} down ${services}`;
	}

	/**
	 * Save available logs from services in the compose file. Outputs a log file named after the provided ID during
	 * construction.
	 */
	async saveLogs(...services: string[]) {
		return this
			.#run`${this.#cmd} ${this.#prefix} logs -t -n ${services} &> ${this.#id}.log`;
	}
}
