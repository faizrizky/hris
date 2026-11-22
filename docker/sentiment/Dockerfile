# Layanan sentimen IndoBERT untuk Background Check (nada postingan: positif/netral/negatif).
# Model dipanggang ke image saat build, jadi container tidak butuh internet saat jalan.
FROM python:3.12-slim

# Revisi dikunci supaya bobot model tidak berubah diam-diam (lisensi MIT, 3 kelas).
ENV MODEL_ID=taufiqdp/indonesian-sentiment \
    MODEL_REVISION=7b102f732bbce270807db57cde99c8c202bb2ad7 \
    HF_HOME=/opt/hf \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "transformers>=4.44,<5" safetensors

# Hanya safetensors yang diunduh (bukan pytorch_model.bin berformat pickle)
RUN python -c "import os; from huggingface_hub import snapshot_download; snapshot_download(os.environ['MODEL_ID'], revision=os.environ['MODEL_REVISION'], allow_patterns=['*.json', '*.txt', '*.safetensors'])"

ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
WORKDIR /srv
COPY app.py .
RUN useradd -r sentiment && chown -R sentiment /opt/hf
USER sentiment
EXPOSE 8000
CMD ["python", "app.py"]
