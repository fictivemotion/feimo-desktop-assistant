"""Local CPU OCR worker. PNG bytes arrive through stdin; no screenshot upload."""
import os
os.environ.setdefault("OMP_NUM_THREADS", "4")
import sys, json, base64, time, contextlib, io

def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def load_engines():
    # Cap all ONNX sessions, including formula encoder/decoder sessions.
    import onnxruntime as ort
    original = ort.InferenceSession
    def session(*args, **kwargs):
        options = kwargs.get("sess_options") or ort.SessionOptions()
        options.intra_op_num_threads = 4
        options.inter_op_num_threads = 1
        kwargs["sess_options"] = options
        return original(*args, **kwargs)
    ort.InferenceSession = session
    from rapidocr import RapidOCR
    from rapid_table import RapidTable, RapidTableInput
    from rapid_latex_ocr import LaTeXOCR
    ocr = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 4, "EngineConfig.onnxruntime.inter_op_num_threads": 1})
    table = RapidTable(RapidTableInput(engine_cfg={"intra_op_num_threads": 4, "inter_op_num_threads": 1}))
    formula = LaTeXOCR()
    return ocr, table, formula

try:
    with contextlib.redirect_stdout(sys.stderr):
        ocr, table, formula = load_engines()
    emit({"ready": True, "models": ["RapidOCR", "SLANet-plus", "LaTeX-OCR"], "provider": "CPU"})
except Exception as error:
    emit({"ready": False, "error": str(error)[:500]})
    sys.exit(1)

if "--prepare" in sys.argv:
    sys.exit(0)

for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        raw = base64.b64decode(request["image"], validate=True)
        from PIL import Image
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        if image.width * image.height > 24000000:
            raise ValueError("截图过大，请缩小选区")
        import numpy as np
        bgr = np.asarray(image)[:, :, ::-1].copy()
        started = time.perf_counter()
        with contextlib.redirect_stdout(sys.stderr):
            if request["kind"] == "formula":
                text, _ = formula(raw)
                result = "$$\n" + text.strip().strip("$") + "\n$$"
            else:
                recognized = ocr(bgr)
                if recognized.txts is None or not len(recognized.txts):
                    raise ValueError("选区没有识别到文字，请调整区域后重试")
                if request["kind"] == "table":
                    result = table(bgr, ocr_results=[(recognized.boxes, recognized.txts, recognized.scores)]).pred_htmls[0]
                elif request["kind"] == "translate":
                    lines = []
                    for box, text in zip(recognized.boxes, recognized.txts):
                        xs, ys = box[:, 0], box[:, 1]
                        lines.append({"text": text, "x": float(xs.min()), "y": float(ys.min()), "w": float(xs.max()-xs.min()), "h": float(ys.max()-ys.min())})
                    result = {"width": image.width, "height": image.height, "lines": lines}
                else:
                    result = "\n".join(recognized.txts)
        emit({"id": request["id"], "result": result, "ms": round((time.perf_counter()-started)*1000)})
    except Exception as error:
        emit({"id": request.get("id"), "error": str(error)[:500]})
