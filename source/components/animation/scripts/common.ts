import { Key } from "@candlelib/glow";

export const curve_colors = [
    "#9b55c9",
    "#2df0f7",
    "#f25124",
    "#f54949",
    "#e6ba1e", //Light-Gold,
];

export function drawCurves(
    keys: Key<any>[],
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    scaleX: number,
    scaleY: number,
    upx: number,
    upy: number,
    color: string = "#9b55c9"
) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    let px = 0;
    let py = 0;
    let prev = null;

    //Get min and max values to scale items accordingly

    for (const key of keys) {

        const x = key.t_off * scaleX + offsetX;
        const y = key.val * scaleY + offsetY;

        ctx.save();

        if (prev) {

            let sx = (x - px);
            let sy = (y - py);

            ctx.beginPath();
            ctx.moveTo(px, py);

            if (key.p1_x >= 0) {

                if (key.p2_x >= 0) {
                    let p1x = (key.p1_x * sx + px);
                    let p1y = (key.p1_y * sy + py);
                    let p2x = (key.p2_x * sx + px);
                    let p2y = (key.p2_y * sy + py);
                    //Cubic
                    ctx.bezierCurveTo(
                        p1x,
                        p1y,
                        p2x,
                        p2y,
                        x, y
                    );
                    ctx.stroke();

                    //Draw lines from center to handle
                    drawLine(ctx, p1x, p1y, px, py, 1);
                    drawLine(ctx, p2x, p2y, x, y, 1);

                    drawBox(ctx, p1x, p1y, isPointNear(p1x, p1y, upx, upy, 3) ? 4 : 3);
                    drawBox(ctx, p2x, p2y, isPointNear(p2x, p2y, upx, upy, 3) ? 4 : 3);

                } else {
                    let p1x = (key.p1_x * sx + px);
                    let p1y = (key.p1_y * sy + py);
                    //Quadratic
                    ctx.quadraticCurveTo(
                        p1x,
                        p1y,
                        x, y
                    );

                    drawLine(ctx, p1x, p1y, px, py, 1);
                    drawLine(ctx, p1x, p1y, x, y, 1);

                    ctx.stroke();
                    drawBox(ctx, p1x, p1y, isPointNear(p1x, p1y, upx, upy, 3) ? 3 : 2);
                }
            } else {
                ctx.lineTo(x, y);
                ctx.stroke();
            }

            ctx.restore();
        }

        prev = key;
        px = x;
        py = y;
    }

    for (const key of keys) {
        const x = key.t_off * scaleX + offsetX;
        const y = key.val * scaleY + offsetY;
        drawBox(ctx, x, y, isPointNear(x, y, upx, upy, 5) ? 7 : 5);
    }
}
function drawLine(ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number = 1
) {
    ctx.save();
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}
function drawBox(ctx: CanvasRenderingContext2D, p1x: number, p1y: number, r: number) {
    let half_r = r * 0.5;
    ctx.fillRect(p1x - half_r, p1y - half_r, r, r);
}
function isPointNear(x: number, y: number, upx: number, upy: number, distance: number = 6) {
    return Math.abs(x - upx) < distance
        &&
        Math.abs(y - upy) < distance;
}
/**
 * Draws diamond keyframes
 * @param keys
 * @param ctx
 * @param tic_scale
 * @param y
 * @param upx
 * @param upy
 */

export function drawKeys(
    keys: (Key<any>)[],
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    scaleX: number,
    upx: number,
    upy: number
) {
    for (const key of keys) {

        let center_offset = 4;

        const x = key.t_off * scaleX + offsetX;

        if (Math.abs(x - upx) < 6
            &&
            Math.abs(offsetY - upy) < 6) {
            center_offset = 5;
        }

        ctx.save();

        ctx.translate(x, offsetY);

        ctx.rotate(Math.PI / 4);

        ctx.fillRect(
            -center_offset,
            -center_offset,
            center_offset * 2,
            center_offset * 2
        );

        ctx.restore();
    }
}
