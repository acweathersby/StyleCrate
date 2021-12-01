import { AnimProp, Key, NumericKey, VectorAnimProp } from "@candlelib/glow";

const reclaimed_partitions: Partition[] = [];
export const enum PartitionType {
    UNKNOWN,
    CurveHandle = 2,
    CurveNode = 4,
    KeyFrame = 8
}
interface PartitionObject {
    [PartitionType.CurveHandle]: (NumericKey | Key<any>);
    [PartitionType.CurveNode]: (NumericKey | Key<any>);
    [PartitionType.KeyFrame]: (NumericKey | Key<any>);
    [PartitionType.UNKNOWN]: null;
}
export interface PartitionElement<T extends PartitionType> {
    type: T;
    x: number;
    y: number;
    obj: PartitionObject[T];
    group: {
        keyframe: PartitionElement<PartitionType.KeyFrame> | null;
        cnode: PartitionElement<PartitionType.CurveNode> | null;
        p1: PartitionElement<PartitionType.CurveHandle> | null;
        p2: PartitionElement<PartitionType.CurveHandle> | null;
        vec_index: number;
        prop: VectorAnimProp<any> | AnimProp<any>;
    };
    partition: Partition | null;
}
export class Partition {
    max_elements: number;
    x: number;
    y: number;
    half_w: number;
    half_h: number;
    elements: PartitionElement<PartitionType>[];
    partitions: Partition[];

    parent: null | Partition;

    private static reclaim(part: Partition) {
        if (part.partitions.length > 0)
            for (const p of part.partitions)
                Partition.reclaim(p);

        part.partitions.length = 0;
        part.elements.length = 0;
        part.x = 0;
        part.y = 0;
        part.parent = null;

        reclaimed_partitions.push(part);
    }

    private static create(
        max_elements: number,
        w: number = 5000,
        h: number = 5000
    ) {
        if (reclaimed_partitions.length > 0) {
            const part = <Partition>reclaimed_partitions.pop();
            part.half_w = w * 0.5;
            part.half_h = h * 0.5;
            part.max_elements = max_elements;
            return part;
        }

        return new Partition(max_elements, w, h);
    }

    constructor(
        max_elements: number = 2,
        w: number = 5000,
        h: number = 5000
    ) {
        this.parent = null;
        this.x = 0;
        this.y = 0;
        this.half_w = w * 0.5;
        this.half_h = h * 0.5;
        this.partitions = [];
        this.elements = [];
        this.max_elements = max_elements;
    }

    debugDraw(
        ctx: CanvasRenderingContext2D,
        scaleX: number,
        scaleY: number,
        offset_x: number,
        offset_y: number,
        upx: number,
        upy: number
    ) {
        if (this.partitions.length > 0) {
            for (const child_part of this.partitions)
                child_part.debugDraw(ctx, scaleX, scaleY, offset_x, offset_y, upx, upy);
        } else {


            const x = offset_x + this.x * scaleX;
            const y = offset_y + this.y * scaleY;
            const a_half_w = this.half_w * scaleX;
            const a_half_h = this.half_h * scaleY;

            if (x + a_half_w * 2 < 0
                ||
                y + a_half_h * 2 < 0)
                return;

            ctx.save();
            ctx.font = "10px arial";
            if (this.elements.length > 0)
                ctx.fillText(`e: ${this.elements.length}`, x + a_half_w, y + a_half_h);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 0.5;


            ctx.strokeRect(
                x,
                y,
                a_half_w * 2,
                a_half_h * 2
            );
            const c_diff_x = upx - x;
            const c_diff_y = upy - y;

            if (c_diff_x >= 0 && c_diff_x < (a_half_w * 2)
                &&
                c_diff_y >= 0 && c_diff_y < (a_half_h * 2)) {

                ctx.fillStyle = "rgba(255,251,20,0.2)";
                ctx.fillRect(
                    x,
                    y,
                    a_half_w * 2,
                    a_half_h * 2
                );
            }

            const closest = this.getClosest(upx - offset_x, upy - offset_y, 6, scaleX, scaleY);

            if (closest) {

                const { x, y } = closest;

                ctx.fillStyle = "rgba(255,0,20,0.8)";

                let cx = offset_x + x * scaleX;
                let cy = offset_y + y * scaleY;

                ctx.beginPath();

                ctx.moveTo(cx, cy);

                ctx.arc(cx, cy, 10, 0, Math.PI * 2);

                ctx.fill();
            }

            ctx.restore();
        }
    }

    clear() {
        for (const part of this.partitions)
            Partition.reclaim(part);
        this.partitions.length = 0;
        this.elements.length = 0;
    }

    getBox(px: number, py: number, w: number, h: number): PartitionElement<PartitionType>[] {
        return [];
    };
    getRadius(px: number, py: number, r: number): PartitionElement<PartitionType>[] {
        return [];
    };
    /**
     * Return the object that is nearest to the givin {px,py} coord within a
     * radius r from the coord. Returns null if no element is within the range.
     * This mutates the Partition by removing the element before returning it.
     * @param px
     * @param py
     * @param r
     * @param sx
     * @returns
     */
    getClosest(
        px: number,
        py: number,
        r: number,
        sx: number,
        sy: number
    ): PartitionElement<PartitionType> | null {

        const { x, y, half_h, half_w } = this;

        //Check to make sure x and y is within bounds
        let a_x = px - (x * sx);
        let a_y = py - (y * sy);
        let a_w = half_w * sx * 2;
        let a_h = half_h * sy * 2;

        if (a_x < -r || a_x > a_w + r || a_y < -r || a_y > a_h + r)
            return null;

        const rs = r * r;

        if (this.partitions.length > 0) {

            let out = null;
            let smallest = Infinity;

            for (const part of this.partitions) {

                const ele = part.getClosest(px, py, r, sx, sy);

                if (ele) {
                    if (!out) {
                        out = ele;
                    } else {

                        const { x, y } = ele;
                        let dx = x * sx - px;
                        let dy = y * sy - py;
                        let trs = dx * dx + dy * dy;
                        if (trs <= rs && trs < smallest) {
                            //@ts-ignore
                            out = ele;
                            smallest = trs;
                        }
                    }
                }
            }

            return out;

        } else {

            let out = -1;
            let smallest = Infinity;
            let index = 0;

            for (const ele of this.elements) {
                const { x, y } = ele;
                let dx = x * sx - px;
                let dy = y * sy - py;
                let trs = dx * dx + dy * dy;

                if (trs <= rs && trs < smallest) {
                    smallest = trs;
                    out = index;
                }
                index++;
            }

            return out >= 0 ? this.elements[out] : null;
        }
    }

    add(ele: PartitionElement<PartitionType>) {
        const { x, y } = ele;

        if (this.partitions.length > 0) {

            const adjust_x = Math.floor((x - this.x) / this.half_w);
            const adjust_y = Math.floor((y - this.y) / this.half_h);
            const index = adjust_x + adjust_y * 2;

            if (index >= 0 && index < 4)
                this.partitions[index].add(ele);


        } else if (this.elements.length == this.max_elements && this.half_h > 8) {
            this.split();

            for (const ele of this.elements)
                this.add(ele);

            this.add(ele);

            this.elements.length = 0;
        } else {
            ele.partition = this;
            this.elements.push(ele);
        }
    };

    remove(ele: PartitionElement<PartitionType>) {
        if (ele.partition == this) {
            let i = this.elements.indexOf(ele);

            if (i >= 0) {
                this.elements.splice(i, 1);
            } else {
                throw new Error("Element is not a member of partition space");
            }

            if (this.parent)
                this.parent.join();
        }
    };

    numberOfElements(): number {
        if (this.partitions.length > 0) {
            let sum = 0;
            for (const part of this.partitions)
                sum += part.numberOfElements();
            return sum;
        } else {
            return this.elements.length;
        }
    }

    private split() {
        const { x, y, half_h, half_w } = this;

        this.partitions.push(
            Partition.create(this.max_elements, half_w, half_h),
            Partition.create(this.max_elements, half_w, half_h),
            Partition.create(this.max_elements, half_w, half_h),
            Partition.create(this.max_elements, half_w, half_h)
        );

        const [p1, p2, p3, p4] = this.partitions;
        p1.parent = this;
        p2.parent = this;
        p3.parent = this;
        p4.parent = this;
        p1.x = x; p1.y = y;
        p2.x = x + half_w; p2.y = y;
        p3.x = x; p3.y = y + half_h;
        p4.x = x + half_w; p4.y = y + half_h;
    }

    private dissolve(): PartitionElement<PartitionType>[] {

        const ele: PartitionElement<PartitionType>[] = [];

        if (this.partitions.length > 0) {

            for (const part of this.partitions) {
                ele.push(...part.dissolve());
                Partition.reclaim(part);
            }

            this.partitions.length = 0;

            return ele;

        } else {
            return this.elements.slice();
        }
    }
    private join() {

        if (this.partitions.length > 0) {

            if (this.numberOfElements() < this.max_elements - 1) {

                for (const part of this.partitions) {
                    this.elements.push(...part.dissolve());
                    Partition.reclaim(part);
                }

                this.partitions.length = 0;

                if (this.parent)
                    this.parent.join();

                return this.elements.slice();
            }
        }
    }
}
