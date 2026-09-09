-- Metadata only; never persist mail bodies. Partial reads cannot satisfy ack.
CREATE TABLE mail_body_read_progress (
 batch_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 run_id TEXT NOT NULL REFERENCES mail_scan_runs(id),
 body_version TEXT NOT NULL,
 next_offset INTEGER NOT NULL CHECK(next_offset >= 0),
 total_characters INTEGER NOT NULL CHECK(total_characters >= next_offset),
 PRIMARY KEY(batch_id,message_id),
 FOREIGN KEY(batch_id,message_id) REFERENCES mail_scan_batch_items(batch_id,message_id)
);
