import { AnimProp, AnimSequence, Key, NumericKey, VectorAnimProp } from "@candlelib/glow";
import { curve_colors, drawCurves, drawKeys } from "./common.js";
import { Partition, PartitionElement, PartitionType } from './partition.js';

export class SequenceHarness {

    seq: AnimSequence;
    key_partition: Partition;
    curve_partition: Partition;
    offsetY: number;

    constructor(
        seq: AnimSequence
    ) {
        this.seq = seq;
        this.key_partition = new Partition(2, 5000, 5000);
        this.curve_partition = new Partition(2, 2000000, 50000);
        this.curve_partition.y = -25000;
        this.offsetY = 0;
        this.updatePartition();
    }

    propRowOffset(row: number) {
        return row * 20;
    }

    updatePartition() {
        let level = 1;
        this.key_partition.clear();


        for (const [name, prop] of this.seq.props) {
            if (prop instanceof VectorAnimProp) {
                let i = 0;
                for (const keys of prop.scalar_keys) {
                    this.insertKeys(keys, prop, i++, level);
                }
            } else
                this.insertKeys(prop.keys, prop, 0, level);
            level++;
        }
    }

    private insertKeys(
        keys: (NumericKey | Key<any>)[],
        prop: VectorAnimProp<any> | AnimProp<any>,
        vec_index: number,
        level: number
    ) {
        let prev: NumericKey | Key<any> | null = null;

        for (const key of keys) {

            const group: PartitionElement<PartitionType>["group"] = {
                keyframe: null,
                cnode: null,
                p1: null,
                p2: null,
                prop: prop,
                vec_index
            };

            let x = key.t_off, y = this.propRowOffset(level), val = key.val;

            group.keyframe = { type: PartitionType.KeyFrame, x: x, y: y, obj: key, group, partition: null };
            group.cnode = { type: PartitionType.CurveNode, x: x, y: -val, obj: key, group, partition: null };

            this.key_partition.add(group.keyframe);

            this.curve_partition.add(group.cnode);

            if (prev) {
                let px = prev.t_off;
                let py = prev.val;
                let w = x - px;
                let h = val - py;
                if (key.p1_x >= 0) {
                    if (key.p2_x >= 0) {
                        group.p1 = { type: PartitionType.CurveHandle, x: px + w * key.p1_x, y: -(py + h * key.p1_y), obj: key, group, partition: null };
                        this.curve_partition.add(group.p1);
                        group.p2 = { type: PartitionType.CurveHandle, x: px + w * key.p2_x, y: -(py + h * key.p2_y), obj: key, group, partition: null };
                        this.curve_partition.add(group.p2);
                    } else {
                        group.p1 = { type: PartitionType.CurveHandle, x: px + w * key.p1_x, y: -(py + h * key.p1_y), obj: key, group, partition: null };
                        this.curve_partition.add(group.p1);
                    }
                }
            }
            prev = key;
        }

    }

    getPointAt(x: number, y: number) {
    }

    draw(
        ctx: CanvasRenderingContext2D,
        ctx_ele: HTMLCanvasElement,
        /**
         * Screen space x coord of cursor offset from the left
         * canvas border;
         */
        cursor_x: number,
        /**
         * Screen space y coord of cursor offset from the left
         * canvas border;
         */
        cursor_y: number,
        scaleX: number,
        scaleY: number,
        offsetX: number,
        DEBUG: boolean = true
    ) {
        
        //Draw keyframes
        let level = 1;

        const offsetY = this.offsetY;

        ctx.font = '12px ubuntu';
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, 5000, 100);
        ctx.clip();
        if (DEBUG)
            this.key_partition.debugDraw(
                ctx,
                scaleX,
                1,
                offsetX,
                0,
                cursor_x,
                cursor_y
            );

        for (const [name, prop] of this.seq.props) {

            const y = this.propRowOffset(level);

            ctx.fillStyle = "white";
            ctx.fillText(name, 0, y + 6);

            if (prop instanceof VectorAnimProp) {
                for (const keys of prop.scalar_keys) {
                    ctx.fillStyle = "#ff872b";
                    drawKeys(keys, ctx, offsetX, y, scaleX, cursor_x, cursor_y);
                }
            } else {
                ctx.fillStyle = "#2df0f7";
                drawKeys(prop.keys, ctx, offsetX, y, scaleX, cursor_x, cursor_y);
                level++;
            }
        }

        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "rgb(50,50,50)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.rect(0, 100, ctx_ele.width, ctx_ele.height - 100);
        ctx.clip();
        drawRuler(ctx, ctx_ele, offsetY, scaleY);


        ctx.beginPath();
        ctx.rect(50, 100, ctx_ele.width - 50, ctx_ele.height - 100);
        ctx.clip();

        if (DEBUG)
            this.curve_partition.debugDraw(
                ctx,
                scaleX,
                scaleY,
                offsetX,
                offsetY,
                cursor_x,
                cursor_y
            );

        let i = 0;
        for (const [name, prop] of this.seq.props) {
            if (prop instanceof VectorAnimProp) {
                for (const keys of prop.scalar_keys) {
                    const color = curve_colors[i++ % curve_colors.length];
                    drawCurves(keys, ctx, offsetX, offsetY, scaleX, -scaleY, cursor_x, cursor_y, color);
                }
            } else {
                const color = curve_colors[i++ % curve_colors.length];
                drawCurves(prop.keys, ctx, offsetX, offsetY, scaleX, -scaleY, cursor_x, cursor_y, color);
            }
        }

        ctx.restore();

        ctx.clearRect(0, 90, ctx_ele.width, 20);
    }

    getClosest(
        cx: number,
        cy: number,
        r: number,
        offset_x: number,
        sx: number,
        sy: number,
    ) {
        return this.getClosestCurveElement(cx, cy, r, offset_x, sx, sy);
    }

    getClosestCurveElement(
        cx: number,
        cy: number,
        r: number,
        offset_x: number,
        sx: number,
        sy: number,
    ): PartitionElement<PartitionType> | null {
        return this.curve_partition.getClosest(cx - offset_x, cy - this.offsetY, r, sx, sy);
    }
}

function drawRuler(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    offset_y: number,
    scale_y: number
) {

    const
        steps = [
            [Infinity, 0.00005, 0.0005],
            [1600, 0.02, 0.01],
            [800, 0.025, 0.05],
            [400, 0.025, 0.1],
            [200, 0.05, 0.2],
            [100, 0.1, 0.5],
            [50, 0.25, 1],
            [25, 0.5, 2],
            [12.5, 1, 5],
            [6.25, 2.5, 10],
            [3.125, 5, 20],
            [1.556, 10, 50],
            [1, 25, 100],
            [0.25, 50, 200],
            [0.125, 100, 500],
            [0.0625, 250, 1000],
            [0.03125, 500, 2000],
            [-Infinity, 250, 1000],

        ],
        py = offset_y / scale_y,
        max_height = canvas.height;

    let major_notch_distance = 0;
    let minor_notch_distance = 0;

    for (let i = 0; i < steps.length; i++) {
        if (scale_y >= steps[i][0]) {
            major_notch_distance = steps[i][2];
            minor_notch_distance = steps[i][1];
            break;
        }
    }

    const step = major_notch_distance;

    const adjust = (py % (step)) * scale_y;

    let offset = -step * scale_y;

    ctx.fillStyle = "#333";
    let i = 0;
    //Small markers
    while (offset + adjust < max_height) {

        ctx.fillRect(50, offset + adjust, canvas.width, 1);
        offset += minor_notch_distance * scale_y;
    }
    offset = -step * scale_y;

    ctx.fillStyle = "#667";

    let pos_y = offset_y * scale_y;

    //large markers
    while (offset + adjust < max_height) {
        ctx.fillRect(50, offset + adjust, canvas.width, 1);
        ctx.fillText(Math.round(((offset_y) - (offset + adjust)) / scale_y * 100) / 100, 10, offset + adjust);
        //ctx.fillText(offset_y, 10, offset + adjust - 20);
        //ctx.fillText(offset, 10, offset + adjust - 10);
        //ctx.fillText(adjust, 10, offset + adjust);
        offset += major_notch_distance * scale_y;
    }

}