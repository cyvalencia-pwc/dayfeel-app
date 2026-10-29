import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

import app as service


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv('INTERNAL_KEY', 'x' * 32)
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key-not-real')
    ai = SimpleNamespace(
        responses=SimpleNamespace(parse=AsyncMock(return_value=SimpleNamespace(status='completed', output_parsed=service.Reply(reply='Try a gentle pause.')))),
        moderations=SimpleNamespace(create=AsyncMock()), close=AsyncMock(),
    )
    safe = SimpleNamespace(results=[SimpleNamespace(flagged=False, categories=SimpleNamespace(model_dump=lambda **kw: {}))])
    ai.moderations.create.return_value = safe
    monkeypatch.setattr(service, 'AsyncOpenAI', lambda **kw: ai)
    with TestClient(service.app) as client:
        original_http = service.app.state.http
        identity = AsyncMock()
        identity.get.return_value = httpx.Response(200, json={'companionMemory': False, 'aiAnalysis': True}, request=httpx.Request('GET', 'http://identity/me'))
        service.app.state.http = identity
        yield client, ai, identity
        service.app.state.http = original_http


HEADERS = {'X-Internal-Key': 'x' * 32, 'Authorization': 'Bearer user-token'}
CHAT = {'messages': [{'role': 'user', 'content': 'What exercise can I try?'}]}


def test_credentials_before_provider(setup):
    client, ai, identity = setup
    assert client.post('/companion/chat', json=CHAT).status_code == 401
    identity.get.return_value = httpx.Response(401, request=httpx.Request('GET', 'http://identity/me'))
    assert client.post('/companion/chat', json=CHAT, headers={**HEADERS, 'Authorization': 'Bearer invalid-token'}).status_code == 401
    ai.responses.parse.assert_not_called()
    ai.moderations.create.assert_not_called()


def test_invalid_jwt_denied(setup):
    client, ai, identity = setup
    identity.get.return_value = httpx.Response(401, request=httpx.Request('GET', 'http://identity/me'))
    assert client.post('/companion/chat', json=CHAT, headers=HEADERS).status_code == 401
    ai.responses.parse.assert_not_called()


@pytest.mark.parametrize('memory', [False, True])
def test_chat_and_consent(setup, memory):
    client, ai, identity = setup
    identity.get.return_value = httpx.Response(200, json={'companionMemory': memory}, request=httpx.Request('GET', 'http://identity/me'))
    result = client.post('/companion/chat', json={**CHAT, 'context': {'averageMood': 3, 'topThemes': ['rest']}, 'summary': 'private history'}, headers=HEADERS)
    assert result.status_code == 200
    assert result.json()['reply'] == 'Try a gentle pause.'
    args = ai.responses.parse.call_args.kwargs
    sent = json.loads(args['input'][0]['content'])
    assert ('context' in sent) == memory
    assert ('summary' in sent) == memory
    assert args['store'] is False
    assert ai.moderations.create.call_count == 2


def test_crisis_short_circuit(setup):
    client, ai, _ = setup
    ai.moderations.create.return_value = SimpleNamespace(results=[SimpleNamespace(flagged=True, categories=SimpleNamespace(model_dump=lambda **kw: {'self-harm/intent': True}))])
    result = client.post('/companion/chat', json=CHAT, headers=HEADERS)
    assert result.status_code == 200
    assert result.json()['reply'] == service.SUPPORT
    ai.responses.parse.assert_not_called()
    assert client.post('/safety/crisis-check', json={'text': 'test'}, headers=HEADERS).json() == {'riskLevel': 'HIGH'}


def test_safety_failure_does_not_generate(setup):
    client, ai, _ = setup
    ai.moderations.create.side_effect = RuntimeError('private provider details')
    result = client.post('/companion/chat', json=CHAT, headers=HEADERS)
    assert result.status_code == 503
    assert 'private' not in result.text
    ai.responses.parse.assert_not_called()


def test_provider_refusal_and_failure(setup):
    client, ai, _ = setup
    ai.responses.parse.return_value = SimpleNamespace(status='completed', output_parsed=None)
    assert client.post('/companion/chat', json=CHAT, headers=HEADERS).status_code == 503
    ai.responses.parse.side_effect = RuntimeError('secret')
    result = client.post('/companion/chat', json=CHAT, headers=HEADERS)
    assert result.status_code == 503
    assert 'secret' not in result.text


def test_output_screening(setup):
    client, ai, _ = setup
    safe = ai.moderations.create.return_value
    unsafe = SimpleNamespace(results=[SimpleNamespace(flagged=True, categories=SimpleNamespace(model_dump=lambda **kw: {}))])
    ai.moderations.create.side_effect = [safe, unsafe]
    response = client.post('/companion/chat', json=CHAT, headers=HEADERS)
    assert response.status_code == 200
    assert 'breathing exercise' in response.json()['reply']


def test_input_limits_no_echo(setup):
    client, ai, _ = setup
    r = client.post('/companion/chat', json={'messages': [{'role': 'system', 'content': 'private secret'}]}, headers=HEADERS)
    assert r.status_code == 422
    assert 'private secret' not in r.text
    ai.responses.parse.assert_not_called()


def test_moderation(setup):
    client, ai, _ = setup
    ai.responses.parse.return_value = SimpleNamespace(status='completed', output_parsed=service.Verdict(verdict='SPAM'))
    assert client.post('/moderate', json={'text': 'advertising'}, headers=HEADERS).json() == {'verdict': 'SPAM'}


def test_emotion_removed(setup):
    client, *_ = setup
    assert client.post('/emotion', json={'text': 'private'}, headers=HEADERS).status_code == 404


def test_memory_withdrawal_discards_reply(setup):
    client, ai, identity = setup
    def response(body):
        return httpx.Response(200, json=body, request=httpx.Request('GET', 'http://identity/me'))
    identity.get.side_effect = [response({}), response({'companionMemory': True}), response({'companionMemory': False})]
    result = client.post('/companion/chat', json={**CHAT, 'summary': 'old memory'}, headers=HEADERS)
    assert result.status_code == 409
    assert 'Try a gentle pause.' not in result.text


