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
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUIDv7 } from "bun";

import type { Queue } from "../src/index";
import { LocalQueue } from "../src/localqueue";
import { checkConformanceForQueue } from "./conformance.ts";

checkConformanceForQueue("LocalQueue-memory", (): Queue => new LocalQueue());
checkConformanceForQueue(
	"LocalQueue-disk",
	(): Queue =>
		new LocalQueue({
			filename: join(
				tmpdir(),
				`conformance-LocalQueue::disk::${randomUUIDv7()}.sqlite`,
			),
		}),
);
