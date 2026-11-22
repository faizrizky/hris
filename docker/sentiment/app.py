"""Layanan kecil: POST /classify {"texts": [...]} -> {"labels": ["positive"|"neutral"|"negative", ...]}.

Hanya dipanggil dari jaringan internal Docker oleh worker Frappe; tidak menyimpan dan tidak
mencatat teks yang dikirim.
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_ID = os.environ["MODEL_ID"]
REVISION = os.environ.get("MODEL_REVISION")
MAX_TEXTS = 500
MAX_BODY_BYTES = 5 * 1024 * 1024
BATCH = 16

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=REVISION)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, revision=REVISION, use_safetensors=True)
model.eval()


def normalize(label: str) -> str:
	label = label.lower()
	return "negative" if label.startswith("neg") else "positive" if label.startswith("pos") else "neutral"


def classify(texts: list[str]) -> list[str]:
	labels: list[str] = []
	for i in range(0, len(texts), BATCH):
		batch = [t or " " for t in texts[i : i + BATCH]]
		enc = tokenizer(batch, truncation=True, max_length=256, padding=True, return_tensors="pt")
		with torch.no_grad():
			ids = model(**enc).logits.argmax(dim=-1).tolist()
		labels += [normalize(model.config.id2label[j]) for j in ids]
	return labels


class Handler(BaseHTTPRequestHandler):
	def _send(self, code: int, payload: dict) -> None:
		body = json.dumps(payload).encode()
		self.send_response(code)
		self.send_header("Content-Type", "application/json")
		self.send_header("Content-Length", str(len(body)))
		self.end_headers()
		self.wfile.write(body)

	def do_GET(self):
		self._send(200, {"status": "ok", "model": MODEL_ID}) if self.path == "/health" else self._send(404, {})

	def do_POST(self):
		if self.path != "/classify":
			return self._send(404, {})
		try:
			length = int(self.headers.get("Content-Length") or 0)
			if not 0 < length <= MAX_BODY_BYTES:
				return self._send(413, {"error": "body too large or empty"})
			texts = json.loads(self.rfile.read(length)).get("texts")
			if not isinstance(texts, list) or len(texts) > MAX_TEXTS or not all(isinstance(t, str) for t in texts):
				return self._send(400, {"error": "texts must be a list of at most %d strings" % MAX_TEXTS})
			self._send(200, {"labels": classify(texts)})
		except (ValueError, AttributeError):
			self._send(400, {"error": "invalid JSON"})

	def log_message(self, *args):
		# Tidak mencatat permintaan: isinya data pribadi kandidat
		pass


if __name__ == "__main__":
	ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
