import glow, { AnimateObjectArg, AnimProp, AnimSequence, Key, VectorAnimProp } from "@candlelib/glow";
import spark, { Sparky } from "@candlelib/spark";
import { ObservableModel, ObservableWatcher } from "@candlelib/wick";
import { SequenceHarness } from './sequence.js';
import { PartitionElement, PartitionType } from "./partition.js";


const enum DeltaType { "NONE", "KF", "SCRUB", "PAN" };

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
    scale_y: number;
    root_x: number;
    root_y: number;
    offset_x: number;
    __SCHD__: number;
    delta_type: DeltaType;
    PLAYING: boolean;
    selected_node: PartitionElement<PartitionType> | null;
    watchers: ObservableWatcher[];
    sequences: SequenceHarness[];

    DEBUG: boolean;

    constructor() {
        this.__SCHD__ = 0;
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
        this.scale_y = 10;
        this.root_x = 0;
        this.root_y = 0;
        this.offset_x = 50;
        this.PLAYING = false;
        this.delta_type = DeltaType.NONE;
        this.selected_node = null;
        this.watchers = [];
        this.sequences = [];
        this.DEBUG = false;
    }

    toggle_debug() {
        this.DEBUG = !this.DEBUG;
        spark.queueUpdate(this);
    }

    addSequence(args: AnimateObjectArg) {
        this.sequences.push(new SequenceHarness(<any>glow(args)));
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

    /**
     * Set the play pos head to the x value, where x is 
     * a user space value offset from the edge of the canvas
     * viewport.
     */
    set_play_pos(x: number) {
        if (this.sequences.length > 0) {
            const adjusted_pos = (x - this.offset_x) / this.scale_x;
            const true_x = Math.max(0, adjusted_pos);
            this.play_pos = true_x;
            spark.queueUpdate(this);
        }
    }

    set_zoom_x_delta(delta: number) {
        this.scale_x = Math.min(10, Math.max(0.05, this.scale_x + delta));
        spark.queueUpdate(this);
    }

    set_zoom_y_delta(delta: number) {
        this.scale_y = Math.min(100, Math.max(0.05, this.scale_y + delta * this.scale_y));
        spark.queueUpdate(this);
    }


    set_ele(ele: HTMLElement) {
        this.preview_element = ele;
        if (this.preview_element)
            this.addSequence(<any>{
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
                    val: "translateX(20px) rotate(20deg)",
                    dur: 0,
                }, {
                    val: "translateX(0px)",
                    dur: 1100,
                }, {
                    val: "translateX(-20px) rotate(-20deg)",
                    dur: 1100,
                    //@ts-expect-error
                    eas: glow.easing.ease_out
                }]
            });
    }

    set_play_pos_to_prev_keyframe() {

        if (this.sequences.length == 0) return;
        const { seq } = this.sequences[0];
        let true_x = 0;

        for (const [, prop] of seq.props) {
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

        if (this.sequences.length == 0) return;

        const { seq } = this.sequences[0];

        let true_x = seq.duration;

        for (const [, prop] of seq.props) {
            let candidate = seq.duration;


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
    pause() {
        if (this.sequences.length > 0) {
            if (this.PLAYING) {
                this.PLAYING = false;
            }
        }
    }

    play() {
        if (this.sequences.length > 0) {
            const { seq } = this.sequences[0];
            if (!this.PLAYING) {
                if (this.play_delta > 0) {
                    if (this.play_pos >= seq.duration)
                        this.play_pos = 0;
                } else {
                    if (this.play_pos <= 0)
                        this.play_pos = seq.duration;
                }

                this.start_pos = this.play_pos;
                this.PLAYING = true;

                spark.queueUpdate(this);
            }
        }
        return false;
    }

    run(val: number) {
        for (const { seq } of this.sequences) {
            if (val >= seq.duration) {
                seq.run(seq.duration);
            } else if (val <= 0) {
                seq.run(0);
            } else {
                seq.run(val);
            }
        }
    }

    scheduledUpdate(step_ratio: number, diff: number) {
        if (this.sequences.length > 0) {
            const active_sequence = this.sequences[0];

            if (this.PLAYING) {
                this.play_pos += ((step_ratio * this.play_delta) * (16.66));
                spark.queueUpdate(this);
            }

            if (this.play_delta > 0) {


                this.run(this.play_pos);

                if (this.PLAYING && this.play_pos >= active_sequence.seq.duration) {
                    this.play_pos = this.start_pos;
                }
            }

            this.draw();

            this.updateWatchers();
        }
    }

    updateKeyframes() {

        // for (const [name, prop] of this.anim.props)
        //     prop.updateKeys();

        spark.queueUpdate(this);
    }

    draw() {

        if (this.ctx && this.ctx_ele) {

            const ctx = this.ctx;
            const offsetX = 0;
            const offsetY = 0;
            const scaleX = this.scale_x;
            const scaleY = this.scale_y;
            const upx = this.user_x;
            const upy = this.user_y;
            const width = this.ctx_ele.width;
            const height = this.ctx_ele.height;
            const tic_distance = 100 * this.scale_x;
            const gutter_size = 50;

            this.ctx_ele.width = this.ctx_ele.width;

            //Draw tic marks
            let tic_mark_count = Math.round(width / tic_distance);

            ctx.fillStyle = "rgb(50,50,50)";

            for (let i = 0; i < tic_mark_count - gutter_size; i++)
                ctx.fillRect(i * tic_distance + gutter_size, 0, 1, height);

            //Draw user input focus
            {

                ctx.fillStyle = "rgb(150,50,50)";
                ctx.fillRect(upx, 0, 1, height);

                ctx.fillStyle = "rgb(120,50,50)";
                ctx.fillRect(0, upy, width, 0.5);
            }

            //Draw current frame line
            {
                const px = this.play_pos * scaleX + this.offset_x;
                ctx.fillStyle = "rgb(150,150,50)";
                ctx.fillRect(px - 0.5, 0, 1, height);
            }

            for (const seq of this.sequences)
                seq.draw(ctx, upx, upy, scaleX, scaleY, this.offset_x, this.DEBUG);


        }
    }

    start_delta(
        x: number,
        y: number,
        button: number = 0
    ) {
        this.root_x = x;
        this.root_y = y;

        if (button == 1) {
            this.delta_type = DeltaType.PAN;
        } else if (this.sequences.length > 0) {

            const seq = this.sequences[0];

            const upx = this.root_x;
            const upy = this.root_y;

            const obj = seq.getClosest(
                upx,
                upy,
                5,
                this.offset_x,
                this.scale_x,
                this.scale_y
            );

            if (obj) {
                this.selected_node = obj;

                const { group: { cnode, keyframe, p1, p2 } } = this.selected_node;

                if (keyframe && keyframe.partition) keyframe.partition.remove(keyframe);
                if (cnode && cnode.partition) cnode.partition.remove(cnode);
                if (p1 && p1.partition) { p1.partition.remove(p1); }
                if (p2 && p2.partition) { p2.partition.remove(p2); }


                this.delta_type = DeltaType.KF;
            } else {
                this.delta_type = DeltaType.SCRUB;
                this.set_play_pos(x);
            }
        }
    }

    apply_delta(
        x: number,
        y: number
    ) {
        if (
            this.delta_type != DeltaType.NONE
            &&
            this.sequences.length > 0
        ) {
            const s1 = this.sequences[0];
            const { seq } = s1;

            const diff_x = x - this.root_x;
            const diff_y = y - this.root_y;
            this.root_x = x;
            this.root_y = y;

            switch (this.delta_type) {
                case DeltaType.KF:

                    if (this.selected_node) {
                        switch (this.selected_node.type) {
                            case PartitionType.CurveHandle:
                                break;
                            case PartitionType.CurveNode: {
                                this.modifyKeyframePos(<any>this.selected_node, diff_x, diff_y, seq);
                            } break;
                            case PartitionType.KeyFrame: {
                                this.modifyKeyframePos(<any>this.selected_node, diff_x, 0, seq);

                            } break;
                            default: break;
                        }
                    }
                    break;
                case DeltaType.SCRUB:
                    this.set_play_pos((this.play_pos * this.scale_x) + diff_x + this.offset_x);
                    break;
                case DeltaType.PAN:
                    this.offset_x = Math.min(50, this.offset_x + diff_x);
                    s1.offsetY = Math.min(5000, Math.max(-5000, s1.offsetY + diff_y));
                    break;
            }

            spark.queueUpdate(this);
        }
    }

    end_delta() {
        if (this.sequences.length > 0) {
            //Add a history object if changes were detected
            const { key_partition, curve_partition } = this.sequences[0];
            if (this.selected_node) {
                const { group: { cnode, keyframe, p1, p2 } } = this.selected_node;

                if (keyframe) key_partition.add(keyframe);
                if (cnode) curve_partition.add(cnode);
                if (p1) curve_partition.add(p1);
                if (p2) curve_partition.add(p2);
            }
        }
        this.delta_type = DeltaType.NONE;
        this.selected_node = null;
    }

    private modifyKeyframePos(
        node: PartitionElement<PartitionType.KeyFrame | PartitionType.CurveNode>,
        diff_x: number,
        diff_y: number,
        seq: AnimSequence,
    ) {
        const {
            x, y, obj, group: { vec_index, prop, keyframe, cnode, p1, p2 }
        } = <PartitionElement<PartitionType.KeyFrame>>node;

        const dx = diff_x / this.scale_x;
        const dy = diff_y / this.scale_y;

        obj.t_off += dx;
        if (dy) obj.val = prop instanceof VectorAnimProp
            ? obj.val - dy
            : obj.val.from(obj.val - dy);

        if (keyframe)
            keyframe.x += dx;
        if (cnode) {
            cnode.x += dx;
            cnode.y += dy;
        }

        if ((p1 || p2) && keyframe?.obj) {
            let keys = prop instanceof VectorAnimProp ? prop.scalar_keys[vec_index] : prop.keys;
            let prev_index = keys.indexOf(keyframe.obj) - 1;
            if (prev_index >= 0) {
                let prev = keys[prev_index];
            } else {
                if (p1)
                    p1.x = -1;
                if (p2)
                    p2.x = -1;
            }
        }

        if (prop instanceof VectorAnimProp) {
            prop.updateKeys(vec_index);
        } else {
            prop.updateKeys();
        }

        let max = 0;
        for (const [, prop] of seq.props)
            max = Math.max(prop.duration, max);

        seq.duration = max;
    }
}