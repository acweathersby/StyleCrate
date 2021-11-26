import Animation from "/@candlelib/glow";
import spark from "/@candlelib/spark";

export class AnimSys {

    constructor() {
        this.user_x = 0;
        this.user_y = 0;

        this.anim = null;
        this.ctx = null;
        this.ctx_ele = null;
        this.preview_element = null;
        this.play_delta = 1;
        this.play_pos = 0;
        this.scale_x = 0.2;
        this.__SCHD__ = 0;
    }

    set_user_x(v) {
        this.user_x = +v || 0;;
    }

    set_user_y(v) {
        this.user_y = +v || 0;;
    }

    set_ctx(ctx_e) {
        this.ctx_ele = ctx_e;
        this.ctx = ctx_e.getContext("2d");
    }

    set_ele(ele) { this.preview_element = ele; this.set(); }

    /**
     * Set the play pos head to the x value, where x is 
     * a user space value offset from the edge of the canvas
     * viewport.
     * @param {number} x 
     */
    set_transport(x) {
        if (this.anim) {
            const adjusted_pos = x / this.scale_x;
            const true_x = Math.max(0, Math.min(this.anim.duration, adjusted_pos));
            this.play_pos = true_x;
            this.drawGraph();
        }
    }

    set() {
        this.anim = Animation({
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
                eas: Animation.easing.ease_in
            }, {
                val: "translateX(-200px)",
                dur: 1100,
                eas: Animation.easing.ease_out
            }]
        });
    }

    scheduledUpdate(step_ratio, diff) {
        if (this.play_delta > 0) {

            this.play_pos += ((step_ratio * this.play_delta) * (16.66));

            this.run(this.play_pos);

            if (this.play_pos >= this.anim.duration) {
                this.play_pos = this.start_pos;
            }
        }
        this.drawGraph();

        if (this.PLAYING)
            spark.queueUpdate(this);
    }

    run(val) {
        if (val >= this.anim.duration) {
            this.anim.run(this.anim.duration);
        } else if (val <= 0) {
            this.anim.run(0);
        } else {
            this.anim.run(val);
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

    drawGraph() {

        this.ctx_ele.width = this.ctx_ele.width;
        const width = this.ctx_ele.width;
        const height = this.ctx_ele.height;
        const tic_scale = this.scale_x;
        const ctx = this.ctx;

        const tic_distance = 20;



        //Draw tic marks
        let tic_mark_count = Math.round(width / tic_distance);

        ctx.fillStyle = "rgb(50,50,50)";

        for (let i = 0; i < tic_mark_count; i++) {
            ctx.fillRect(i * tic_distance, 0, 1, height);
        }

        if (this.anim) {

            //Draw keyframes
            let level = 1;

            ctx.font = '12px ubuntu';

            for (const [name, prop] of this.anim.props) {
                const center_offset = 4;
                const y = ((level * 20) - center_offset);

                ctx.fillStyle = "white";
                ctx.fillText(name, 0, y + 6);

                for (const key of prop.keys) {
                    ctx.fillStyle = "yellow";
                    const start = key.starting_tic + key.duration;
                    const delay = key.t_del;
                    const x = ((start) - center_offset) * tic_scale;

                    ctx.save();

                    ctx.translate(x, y);
                    ctx.rotate(Math.PI / 4);

                    ctx.fillRect(0, 0, center_offset * 2, center_offset * 2);

                    ctx.restore();
                }
                level++;
            }
        }

        //Draw user input focus
        {
            const px = this.user_x;
            ctx.fillStyle = "rgb(150,50,50)";
            ctx.fillRect(px, 0, 1, height);
            const py = this.user_y;
            ctx.fillStyle = "rgb(120,50,50)";
            ctx.fillRect(0, py, width, 0.5);
        }

        //Draw transport position
        {
            const px = this.play_pos * tic_scale;
            ctx.fillStyle = "rgb(150,150,50)";
            ctx.fillRect(px - 0.5, 0, 1, height);
        }
    }
}