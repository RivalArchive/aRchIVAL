# @archival/Queue

Queues are used within archival by different components to pass around pieces
of work. Depending on the method of deployment the available infrastructure
that can be used to create a reliable queue may be different. This package defines
a common FIFO Queue interface and varying implementations that can be chosen as needed.

## LocalQueue

A SQLite-backed queue which is local to the current system. Backed by
[Bun's SQLite library][bun_sqlite]. Can function purely in memory and on disk for
data persistence.

[bun_sqlite]: https://bun.sh/docs/api/sqlite
