
import glow, { AnimProp, AnimSequence, Key } from "@candlelib/glow";

import spark, { Sparky } from "@candlelib/spark";

export class AnimSys implements Sparky {

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
    selected_keyframes: [Key<any> | null, Key<any>, Key<any> | null, AnimProp<any>] | null;

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
    }
    set() {
        //@ts-ignore
        this.anim = glow({
            obj: this.preview_element,
            opacity: [{
                val: 0,
                dur: 0,
                del: 200
            }, {
                val: 1,
                dur: 500,
            }, {
                val: 1,
                dur: 1400,
            }, {
                val: 0,
                dur: 200,
            }],
            transform: [{
                val: "translateX(200px)",
                dur: 0
            }, {
                val: "translateX(0px)",
                dur: 1100,
                //@ts-expect-error
                eas: glow.easing.ease_in
            }, {
                val: "translateX(-200px)",
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
            for (const kf of prop.keys) {
                if (kf.starting_tic + kf.duration >= this.play_pos)
                    continue;
                else {
                    candidate = kf.starting_tic + kf.duration;
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

            for (const kf of prop.keys) {
                if (kf.starting_tic + kf.duration <= this.play_pos)
                    continue;
                else {
                    candidate = kf.starting_tic + kf.duration;
                    break;
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
        }
    }

    getKeyFrameAtPoint(upx = this.user_x, upy = this.user_y): [Key<any> | null, Key<any>, Key<any> | null, AnimProp<any>] | null {

        if (!this.anim) return null;

        let level = 1;



        for (const [name, prop] of this.anim.props) {

            const y = (level * 20);

            let prev = null;

            let i = 0;

            for (const key of prop.keys) {

                const start = key.starting_tic + key.duration;
                const x = (start) * this.scale_x;

                if (
                    Math.abs(x - upx) < 6
                    &&
                    Math.abs(y - upy) < 6
                ) {
                    return [prev, key, prop.keys[i + 1] || null, prop];
                }

                prev = key;

                i++;
            }
            level++;
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

                    for (const key of prop.keys) {



                        let center_offset = 4;
                        ctx.fillStyle = "yellow";
                        const start = key.starting_tic + key.duration;
                        const delay = key.t_del;
                        const x = (start) * tic_scale;

                        if (
                            Math.abs(x - upx) < 6
                            &&
                            Math.abs(y - upy) < 6
                        ) {
                            center_offset = 5;
                        }

                        if (key.t_del > 0) {
                            ctx.save();
                            ctx.fillStyle = ("red");

                            ctx.fillRect(key.starting_tic * tic_scale, y - 2, key.t_del * tic_scale, 4);

                            ctx.restore();
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
                    level++;
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

                        const [prev, curr, next, prop] = this.selected_keyframes;

                        const x = diff_x / this.scale_x;

                        const adjust = curr.duration + x;

                        if (adjust < 0) {

                        } else if (adjust == 0) {

                        } else if (next && (curr.t_off + x) > next.t_off) {

                        } else {

                            shiftKeyFrame(curr, x);

                            if (next)
                                shiftKeyFrame(next, -x);
                        }


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

function shiftKeyFrame(key: Key<any>, x: number) {

    const xr_del = key.t_del / key.duration;

    const xr_dur = key.t_dur / key.duration;

    const ratio = ((key.duration + x) / key.duration);

    const r_del = ratio * xr_del;

    const r_dur = ratio * xr_dur;

    key.t_del = Math.round(key.t_del * r_del);

    key.t_dur = Math.round(key.t_dur * r_dur);
}
