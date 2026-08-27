#!/usr/bin/env python3
from pathlib import Path

path = Path("src/openhuman/config/schema/load/impl_load.rs")
text = path.read_text()

# TAVIS policy must be applied last, after migrations/env/decryption, so stale
# serialized config or process env cannot redirect production inference around
# OmniRoute. Keep this scoped to load return paths; save() remains unchanged.
replacements = [
    (
        """            config.apply_env_overrides_from(env);\n\n            tracing::debug!(""",
        """            config.apply_env_overrides_from(env);\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n\n            tracing::debug!(""",
        1,
    ),
    (
        """            if migrated_legacy_secrets {\n                // One-time forced migration:""",
        """            if migrated_legacy_secrets {\n                // One-time forced migration:""",
        1,
    ),
    (
        """            }\n            Ok(config)\n        } else {""",
        """            }\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            Ok(config)\n        } else {""",
        1,
    ),
    (
        """            crate::openhuman::config::migrations::run_pending(&mut config).await;\n            Ok(config)\n        }\n    }\n\n    /// Load config from the default user paths""",
        """            crate::openhuman::config::migrations::run_pending(&mut config).await;\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            Ok(config)\n        }\n    }\n\n    /// Load config from the default user paths""",
        1,
    ),
    (
        """            config.apply_env_overrides();\n            return Ok(config);""",
        """            config.apply_env_overrides();\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            return Ok(config);""",
        1,
    ),
    (
        """        let _ = decrypt_config_secrets(&mut config, &openhuman_dir)?;\n        Ok(config)""",
        """        let _ = decrypt_config_secrets(&mut config, &openhuman_dir)?;\n        crate::openhuman::config::apply_tavis_defaults(&mut config);\n        Ok(config)""",
        1,
    ),
    (
        """            config.apply_env_overrides_from(&ProcessEnvWithoutWorkspace);\n            return Ok(config);""",
        """            config.apply_env_overrides_from(&ProcessEnvWithoutWorkspace);\n            crate::openhuman::config::apply_tavis_defaults(&mut config);\n            return Ok(config);""",
        1,
    ),
    (
        """        crate::openhuman::config::migrations::run_pending(&mut config).await;\n        Ok(config)\n    }\n\n    pub async fn save""",
        """        crate::openhuman::config::migrations::run_pending(&mut config).await;\n        crate::openhuman::config::apply_tavis_defaults(&mut config);\n        Ok(config)\n    }\n\n    pub async fn save""",
        1,
    ),
]

for old, new, expected in replacements:
    found = text.count(old)
    if found != expected:
        raise SystemExit(f"patch target mismatch: expected {expected}, found {found}: {old[:80]!r}")
    text = text.replace(old, new, expected)

path.write_text(text)
