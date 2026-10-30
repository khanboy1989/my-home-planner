"""
The architect's drawing as a plain PDF: no electrical project on it.

    .venv/bin/python tools/plan-pdf.py      # → assets/30102026_FINAL DRAFT.pdf

Renders the DWG the model reads, exactly as drawn — nothing in it is
changed — as two A1 pages: the plans, then the elevations, section and
levels (east of PLANS_MAX_X). Shares the DWG reader with
tools/electric-plan.py.
"""
import importlib.util
import os
import tempfile

import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from ezdxf import bbox
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.config import BackgroundPolicy, ColorPolicy, Configuration
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('electric_plan', os.path.join(HERE, 'electric-plan.py'))
ep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ep)

W, H = 841, 594                                # A1 landscape, mm
MARGIN = 0.03


def page(doc, ents, pdf):
    """One page: these entities, fitted to the sheet with their proportions."""
    ext = bbox.extents(ents, fast=True)
    x0, y0, x1, y1 = ext.extmin.x, ext.extmin.y, ext.extmax.x, ext.extmax.y
    w, h = x1 - x0, y1 - y0
    if w / h > W / H:
        pad = (w * H / W - h) / 2
        y0, y1 = y0 - pad, y1 + pad
    else:
        pad = (h * W / H - w) / 2
        x0, x1 = x0 - pad, x1 + pad
    mx, my = (x1 - x0) * MARGIN, (y1 - y0) * MARGIN
    fig = plt.figure(figsize=(W / 25.4, H / 25.4))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    cfg = Configuration(background_policy=BackgroundPolicy.WHITE,
                        color_policy=ColorPolicy.BLACK, lineweight_scaling=0.6)
    Frontend(RenderContext(doc), MatplotlibBackend(ax), config=cfg).draw_entities(ents)
    ax.set_xlim(x0 - mx, x1 + mx)
    ax.set_ylim(y0 - my, y1 + my)
    ax.set_aspect('auto')
    pdf.savefig(fig)
    plt.close(fig)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        doc = ezdxf.readfile(ep.dwg_to_dxf(ep.PLAN_DWG, tmp, 'plan.dxf'))
    plans, rest = [], []
    for e in doc.modelspace():
        b = bbox.extents([e], fast=True)
        if b.has_data:
            (rest if b.center.x >= ep.PLANS_MAX_X else plans).append(e)
    out = os.path.splitext(ep.PLAN_DWG)[0] + '.pdf'
    with PdfPages(out) as pdf:
        page(doc, plans, pdf)
        page(doc, rest, pdf)
    print('wrote', os.path.relpath(out, ep.ROOT))


if __name__ == '__main__':
    main()
