
import glow, { AnimProp, AnimSequence, Key, VectorAnimProp } from "@candlelib/glow";

import spark, { Sparky } from "@candlelib/spark";

import { ObservableModel, ObservableWatcher } from "@candlelib/wick";

const curve_colors = [
    "#9b55c9", //Purplish
    "#2df0f7", //Light Blue
    "#f25124", //Blood Orange
    "#f54949", //Light Red
    "#e6ba1e", //Light-Gold,
];

export class AnimSys implements Sparky, ObservableModel {

    user_x: number;
    user_y: number;
    anim: AnimSequence | null;
    ctx: CanvasRenderingContext2D | null;
    ctx_ele: HTMLCanvasElement | null;
    preview_element: HTMLElement | null;
    play_delta: number;
    play_pos: number;

    start_pos: number;
    scale_x: number;
    root_x: number;
    root_y: number;
    __SCHD__: number;
    delta_type: "KF" | "SCRUB";

    PLAYING: boolean;
    selected_keyframes: [Key<any>, AnimProp<any>] | null;

    watchers: ObservableWatcher[];

    constructor() {
        this.user_x = 0;
        this.user_y = 0;
        this.anim = null;
        this.ctx = null;
        this.ctx_ele = null;
        this.preview_element = null;
        this.play_delta = 1;
        this.play_pos = 0;
        this.start_pos = 0;
        this.scale_x = 0.2;
        this.root_x = 0;
        this.root_y = 0;
        this.__SCHD__ = 0;
        this.PLAYING = false;
        this.delta_type = "KF";
        this.selected_keyframes = null;
        this.watchers = [];
    }

    get OBSERVABLE(): true { return true; }

    subscribe(w: ObservableWatcher) {
        if (!this.watchers.includes(w))
            this.watchers.push(w);
        return true;
    }

    unsubscribe(w: ObservableWatcher) {
        let i = this.watchers.indexOf(w);
        if (i >= 0)
            this.watchers.splice(i, 1);
        return true;
    }

    private updateWatchers() {
        for (const w of this.watchers)
            w.onModelUpdate(this);
    }

    set() {
        //@ts-ignore
        this.anim = glow({
            obj: this.preview_element,
            opacity: [{
                val: 0,
                dur: 0,
            }, {
                val: 0,
                dur: 200,
            }, {
                val: 1,
                dur: 500,
            }, {
                val: 1,
                dur: 1400,
            }, {
                val: 0,
                dur: 200
            }],
            transform: [{
                val: "translateX(200px) rotate(20deg)",
                dur: 0,
            }, {
                val: "translateX(0px)",
                dur: 1100,
            }, {
                val: "translateX(-200px) rotate(50deg)",
                dur: 1100,
                //@ts-expect-error
                eas: glow.easing.ease_out
            }]
        });
    }

    set_user_x(v: number) {
        this.user_x = +v || 0;;
        spark.queueUpdate(this);
    }

    set_user_y(v: number) {
        this.user_y = +v || 0;;
        spark.queueUpdate(this);
    }

    set_ctx(ctx_e: HTMLCanvasElement) {
        this.ctx_ele = ctx_e;
        this.ctx = ctx_e.getContext("2d");
    }

    set_ele(ele: HTMLElement) { this.preview_element = ele; this.set(); }

    set_play_pos_to_prev_keyframe() {

        if (!this.anim) return;

        let true_x = 0;

        for (const [, prop] of this.anim.props) {
            let candidate = 0;

            if (prop instanceof VectorAnimProp)
                for (const keys of prop.scalar_keys) {
                    for (const kf of keys) {
                        if (kf.t_off >= this.play_pos)
                            continue;
                        else {
                            candidate = kf.t_off;
                        }
                    }
                }
            else for (const kf of prop.keys) {
                if (kf.t_off >= this.play_pos)
                    continue;
                else {
                    candidate = kf.t_off;
                }
            }
            true_x = Math.max(candidate, true_x);
        }

        this.play_pos = true_x;
        spark.queueUpdate(this);
    }

    set_play_pos_to_next_keyframe() {

        if (!this.anim) return;

        let true_x = this.anim.duration;

        for (const [, prop] of this.anim.props) {
            let candidate = this.anim.duration;


            if (prop instanceof VectorAnimProp) {
                for (const keys of prop.scalar_keys)
                    for (const kf of keys) {
                        if (kf.t_off <= this.play_pos)
                            continue;
                        else {
                            candidate = kf.t_off;
                            break;
                        }
                    }
            } else {
                for (const kf of prop.keys) {
                    if (kf.t_off <= this.play_pos)
                        continue;
                    else {
                        candidate = kf.t_off;
                        break;
                    }
                }
            }

            true_x = Math.min(candidate, true_x);
        }

        this.play_pos = true_x;
        spark.queueUpdate(this);
    }

    /**
     * Set the play pos head to the x value, where x is 
     * a user space value offset from the edge of the canvas
     * viewport.
     */
    set_play_pos(x: number) {
        if (this.anim) {
            const adjusted_pos = x / this.scale_x;
            const true_x = Math.max(0, adjusted_pos);
            this.play_pos = true_x;
            spark.queueUpdate(this);
        }
    }

    pause() {
        if (this.anim) {
            if (this.PLAYING) {
                this.PLAYING = false;
            }
        }
    }

    play() {
        if (this.anim) {
            if (!this.PLAYING) {
                if (this.play_delta > 0) {
                    if (this.play_pos >= this.anim.duration)
                        this.play_pos = 0;
                } else {
                    if (this.play_pos <= 0)
                        this.play_pos = this.anim.duration;
                }

                this.start_pos = this.play_pos;
                this.PLAYING = true;

                spark.queueUpdate(this);
            }
        }
        return false;
    }

    run(val: number) {
        if (this.anim)
            if (val >= this.anim.duration) {
                this.anim.run(this.anim.duration);
            } else if (val <= 0) {
                this.anim.run(0);
            } else {
                this.anim.run(val);
            }

    }

    scheduledUpdate(step_ratio: number, diff: number) {
        if (this.anim) {

            if (this.PLAYING) {
                this.play_pos += ((step_ratio * this.play_delta) * (16.66));
                spark.queueUpdate(this);
            }

            if (this.play_delta > 0) {


                this.run(this.play_pos);

                if (this.PLAYING && this.play_pos >= this.anim.duration) {
                    this.play_pos = this.start_pos;
                }
            }

            this.drawGraph();

            this.updateWatchers();
        }
    }

    getKeyFrameAtPoint(upx = this.user_x, upy = this.user_y): [Key<any>, AnimProp<any>] | null {

        if (!this.anim) return null;

        let level = 1;

        for (const [name, prop] of this.anim.props) {

            if (prop instanceof VectorAnimProp) {

            } else {
                const y = (level * 20);

                for (const key of prop.keys) {
                    const x = key.t_off * this.scale_x;

                    if (
                        Math.abs(x - upx) < 6
                        &&
                        Math.abs(y - upy) < 6
                    ) {
                        return [key, prop];
                    }
                }
                level++;
            }
        }

        return null;
    }

    updateKeyframes() {

        // for (const [name, prop] of this.anim.props)
        //     prop.updateKeys();

        spark.queueUpdate(this);
    }

    drawGraph() {
        if (this.anim && this.ctx && this.ctx_ele) {
            this.ctx_ele.width = this.ctx_ele.width;
            const width = this.ctx_ele.width;
            const height = this.ctx_ele.height;
            const tic_scale = this.scale_x;
            const ctx = this.ctx;
            const upx = this.user_x;
            const upy = this.user_y;
            const tic_distance = 20;

            //Draw tic marks
            let tic_mark_count = Math.round(width / tic_distance);

            ctx.fillStyle = "rgb(50,50,50)";

            for (let i = 0; i < tic_mark_count; i++) {
                ctx.fillRect(i * tic_distance, 0, 1, height);
            }



            //Draw user input focus
            {

                ctx.fillStyle = "rgb(150,50,50)";
                ctx.fillRect(upx, 0, 1, height);

                ctx.fillStyle = "rgb(120,50,50)";
                ctx.fillRect(0, upy, width, 0.5);
            }

            //Draw transport position
            {
                const px = this.play_pos * tic_scale;
                ctx.fillStyle = "rgb(150,150,50)";
                ctx.fillRect(px - 0.5, 0, 1, height);
            }

            if (this.anim) {

                //Draw keyframes
                let level = 1;

                ctx.font = '12px ubuntu';

                for (const [name, prop] of this.anim.props) {

                    const y = (level * 20);

                    ctx.fillStyle = "white";
                    ctx.fillText(name, 0, y + 6);

                    if (prop instanceof VectorAnimProp) {
                        for (const keys of prop.scalar_keys) {
                            ctx.fillStyle = "#ff872b";
                            drawKeys(keys, ctx, tic_scale, y, upx, upy);
                        }
                    } else {
                        ctx.fillStyle = "#2df0f7";
                        drawKeys(prop.keys, ctx, tic_scale, y, upx, upy);
                        level++;
                    }
                }
                let i = 0;
                for (const [name, prop] of this.anim.props) {
                    if (prop instanceof VectorAnimProp) {
                        for (const keys of prop.scalar_keys) {
                            const color = curve_colors[i++ % curve_colors.length];
                            drawCurves(keys, ctx, tic_scale, upx, upy, color);
                        }
                    } else {
                        const color = curve_colors[i++ % curve_colors.length];
                        drawCurves(prop.keys, ctx, tic_scale, upx, upy, color);
                    }
                }
            }
        }
    }

    start_delta(
        x: number,
        y: number
    ) {
        this.root_x = x;
        this.root_y = y;

        const kf = this.getKeyFrameAtPoint(x, y);

        if (kf) {
            this.selected_keyframes = kf;
            this.delta_type = "KF";
        } else {
            this.delta_type = "SCRUB";
            this.set_play_pos(x);
        }
    }

    apply_delta(
        x: number,
        y: number
    ) {
        if (this.anim) {
            const diff_x = x - this.root_x;
            const diff_y = y - this.root_y;
            this.root_x = x;
            this.root_y = y;

            switch (this.delta_type) {
                case "KF":

                    if (this.selected_keyframes) {

                        const [curr, prop] = this.selected_keyframes;

                        const x = diff_x / this.scale_x;

                        curr.t_off += x;

                        prop.updateKeys();

                        let max = 0;

                        for (const [, prop] of this.anim.props)
                            max = Math.max(prop.duration, max);

                        this.anim.duration = max;
                    }
                    break;
                case "SCRUB":
                    this.set_play_pos(this.play_pos * this.scale_x + diff_x);
                    break;
            }

            spark.queueUpdate(this);
        }
    }

    end_delta() {
        //Add a history object if changes were detected
    }
}
function drawCurves(
    keys: Key<any>[],
    ctx: CanvasRenderingContext2D,
    tic_scale: number,
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
    let min_y = Infinity;
    let max_y = -Infinity;

    for (const key of keys) {
        min_y = Math.min(key.val, min_y);
        max_y = Math.max(key.val, max_y);
    }


    let height = (max_y - min_y);
    let height_scale = 1 / height;
    let main_scale = 120 * height_scale;
    const base = (140);

    for (const key of keys) {

        let y = base + (key.val * main_scale);

        const x = key.t_off * tic_scale;

        ctx.save();

        if (prev) {

            let sx = (x - px);
            let sy = (y - py);

            ctx.beginPath();
            ctx.moveTo(px, py);

            if (key.p1_x >= 0) {

                if (key.p2_x >= 0) {
                    let p1x = key.p1_x * sx + px;
                    let p1y = key.p1_y * sy + py;
                    let p2x = key.p2_x * sx + px;
                    let p2y = key.p2_y * sy + py;
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
                    let p1x = key.p1_x * sx + px;
                    let p1y = key.p1_y * sy + py;
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
        let y = base + key.val * main_scale;
        const x = key.t_off * tic_scale;
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

function drawBox(ctx: CanvasRenderingContext2D, p1x: number, p1y: number, r: number,) {
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
function drawKeys(
    keys: (Key<any>)[],
    ctx: CanvasRenderingContext2D,
    tic_scale: number,
    y: number,
    upx: number,
    upy: number
) {
    for (const key of keys) {

        let center_offset = 4;

        const x = key.t_off * tic_scale;

        if (Math.abs(x - upx) < 6
            &&
            Math.abs(y - upy) < 6) {
            center_offset = 5;
        }

        ctx.save();

        ctx.translate(x, y);

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


class Partition {
    width: number;
    height: number;
    elements: any[];
    partitions: Partition[];
    constructor(
        w: number,
        h: number,
    ) {
        this.height = h;
        this.width = w;
        this.partitions = [];
        this.elements = [];
    }
    getRadius(px: number, py: number, r: number) { };
    getClosest(px: number, py: number) { }
    add(ele: any) { };
    remove(ele: any) { };
    private split() {

    }
    private join() {

    }
}