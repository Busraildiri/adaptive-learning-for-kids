"""Provider abstraction — mirrors apps/admin-web/src/lib/media/provider.ts.

No `if provider_id == "openmontage"` branching should live outside this
registry; callers resolve a provider by id and call `.generate()`.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from .render_manifest import MediaGenerationInput, MediaGenerationResult


@runtime_checkable
class MediaProvider(Protocol):
    id: str

    def generate(self, input: MediaGenerationInput) -> MediaGenerationResult: ...


_providers: dict[str, MediaProvider] = {}


def register_provider(provider: MediaProvider) -> None:
    _providers[provider.id] = provider


def get_provider(provider_id: str) -> MediaProvider:
    provider = _providers.get(provider_id)
    if provider is None:
        raise KeyError(f"Bilinmeyen media provider: {provider_id}")
    return provider


def list_provider_ids() -> list[str]:
    return list(_providers.keys())
