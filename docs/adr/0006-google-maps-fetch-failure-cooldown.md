# Google Maps Fetch Failure Cooldown

Google Maps upstream failures will be recorded as short-lived Google Maps Fetch Failure Cooldowns keyed by the failed operation identity, rather than as cached List Snapshots or as a list-unavailable-only failure table. Link resolution failures are keyed by Google Maps Shared List Link, and list snapshot fetch failures are keyed by Google Maps List ID, so acquisition can suppress repeated requests to Google Maps while preserving the reason the last upstream attempt failed.

This keeps `got` responsible for retrying and classifying individual HTTP attempts, while Google Maps List Acquisition owns the application policy for when a failed upstream operation should temporarily block another attempt.
