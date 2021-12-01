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
        ctx.beginPath();
        ctx.rect(0, 100, 5000, 400);
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

        ctx.clearRect(0, 90, 5000, 20);
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

