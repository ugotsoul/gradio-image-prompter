<svelte:options accessors={true} />

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";

  const dispatch = createEventDispatcher();

  export let width = 0;
  export let height = 0;
  export let natural_width = 0;
  export let natural_height = 0;
  export let use_boxes = true;
  export let use_points = false;

  let prompts: Array<Array<number>> = [];

  let canvas_container: HTMLElement;
  let slot_container: HTMLElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;

  let mouse_pressing: boolean = false;
  let mouse_button: number;
  let prev_x: number, prev_y: number;
  let cur_x: number, cur_y: number;

  let old_width = 0;
  let old_height = 0;
  let canvasObserver: ResizeObserver;
  let mode: 'add' | 'delete' = 'add';


  async function set_canvas_size(dimensions: {
    width: number;
    height: number;
  }) {
    await tick();
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    canvas.style.left = `${slot_container.clientLeft}px`;
    canvas.style.top = `${slot_container.clientTop}px`;
  }

  export async function resize_canvas() {
    if (width === old_width && height === old_height) return;
    await set_canvas_size({ width: width, height: height });
    draw_canvas();
    setTimeout(() => {
      old_height = height;
      old_width = width;

      draw_canvas();
      dispatch("change", prompts);
    }, 1);
  }

  export function clear() {
    prompts = [];
    draw_canvas();
    dispatch("change", prompts);
    return true;
  }

  onMount(async () => {
    ctx = canvas.getContext("2d");
    if (ctx) {
      (ctx.lineJoin = "round"), (ctx.lineCap = "round");
      ctx.strokeStyle = "#000";
    }
    canvasObserver = new ResizeObserver(() => {
      width = canvas_container.clientWidth;
      height = canvas_container.clientHeight;
      if (slot_container.firstElementChild) {
        width = slot_container.firstElementChild.clientWidth;
        height = slot_container.firstElementChild.clientHeight;
      }
      resize_canvas();
    });
    canvasObserver.observe(canvas_container);
    document.addEventListener("keydown", handle_keydown);
    draw_loop();
    clear();
  });

  onDestroy(() => {
    canvasObserver.unobserve(canvas_container);
    document.removeEventListener("keydown", handle_keydown);
  });

  function get_mouse_pos(e: MouseEvent | TouchEvent | FocusEvent) {
    const rect = canvas.getBoundingClientRect();
    let screenX, screenY: number;
    if (e instanceof MouseEvent) {
      screenX = e.clientX;
      screenY = e.clientY;
    } else if (e instanceof TouchEvent) {
      screenX = e.changedTouches[0].clientX;
      screenY = e.changedTouches[0].clientY;
    } else {
      return { x: prev_x, y: prev_y };
    }
    return { x: screenX - rect.left, y: screenY - rect.top };
  }

  function handle_draw_start(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    (mouse_pressing = true), (mouse_button = 0);
    if (e instanceof MouseEvent) mouse_button = e.button;
    const { x, y } = get_mouse_pos(e);
    (prev_x = x), (prev_y = y);
  }

  function handle_draw_move(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const { x, y } = get_mouse_pos(e);
    (cur_x = x), (cur_y = y);
  }

  function handle_draw_end(e: MouseEvent | TouchEvent | FocusEvent) {
    e.preventDefault();
    if (mouse_pressing) {

      const { x, y } = get_mouse_pos(e);
      let x1 = Math.min(prev_x, x);
      let y1 = Math.min(prev_y, y);
      let x2 = Math.max(prev_x, x);
      let y2 = Math.max(prev_y, y);

      let scale_x = natural_width / width;
      let scale_y = natural_height / height;

      x1 = scale_x * x1;
      x2 = scale_x * x2;
      y1 = scale_y * y1;
      y2 = scale_y * y2;

      let box_width = x2 - x1;
      let box_height = y2 - y1;

      let is_point = box_width < 1.0 && box_height < 1.0;

      if (mode == 'add') {
        let typecode = 0;
        let shiftKey = false;
        if (e instanceof MouseEvent) {
          shiftKey = e.shiftKey;
        } else if (e instanceof TouchEvent) {
          shiftKey = e.shiftKey;
        }

        if (is_point && (mouse_button != 0 || mouse_button ==0 && shiftKey)) {
          typecode = 0; // right mouse
        } else if (is_point && mouse_button == 0) {
          typecode = 1; // left mouse
        } else if (!is_point) {
          typecode = 2; // box
        }

        if (use_boxes) {
          if (!is_point) {
            prompts.push([ typecode, Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), ]);
          }
        }

        if (use_points) {
          if (is_point) {
            prompts.push([ typecode, Math.round(x1), Math.round(y1), 0, 0, ]);
          }
        }
      } else if (mode == 'delete') {
        let new_points = [];
        for (let i = 0; i < prompts.length; i++) {
          let prompt = prompts[i];
          if (prompt[0] == 0 || prompt[0] == 1) {
            // points
            if (x1 <= prompt[1] && y1 <= prompt[2] && x2 >= prompt[1] && y2 >= prompt[2]) {
              continue;
            }
          } else if (prompt[0] == 2) {
            // boxes
            if (x1 <= prompt[1] && y1 <= prompt[2] && x2 >= prompt[3] && y2 >= prompt[4]) {
              continue;
            }
          }
          new_points.push(prompt);
        }
        prompts = new_points;
      }
      dispatch("change", prompts);
    }
    mouse_pressing = false;
  }

  function handle_keydown(e: KeyboardEvent) {
    if (!mouse_pressing) {
      if (e.key === 'a') {
        mode = 'add';
      }
      if (e.key === 'd') {
        mode = 'delete';
      }
    }
  }

  function draw_loop() {
    draw_canvas();
    window.requestAnimationFrame(() => {
      draw_loop();
    });
  }

  function draw_canvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    draw_help();

    if (mouse_pressing && cur_x != prev_x && prev_y != cur_y) {
      let x1 = Math.min(prev_x, cur_x);
      let y1 = Math.min(prev_y, cur_y); 
      let x2 = Math.max(prev_x, cur_x);
      let y2 = Math.max(prev_y, cur_y);

      if (mode == 'add') {
        ctx.strokeStyle = "#000";
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      } else if (mode == 'delete') {
        ctx.strokeStyle = "#F00";
        ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
      }

      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.fill();
      ctx.stroke();

      let scale_x = natural_width / width;
      let scale_y = natural_height / height;

      let tmp_box = [
        Math.round(scale_x * x1),
        Math.round(scale_y * y1),
        Math.round(scale_x * x2),
        Math.round(scale_y * y2),
      ];
      if (mode == 'add') {
        draw_prompts(prompts);
      } else if (mode == 'delete') {
        draw_prompts(prompts, tmp_box);
      }
    } else {
      draw_prompts(prompts);
    }
  }


  function draw_point_prompt(prompt: Array<number>, highlighted: boolean = false) {
    if (!ctx) return;
    let scale_x = width / natural_width;
    let scale_y = height / natural_height;
    let x = prompt[1] * scale_x;
    let y = prompt[2] * scale_y;
    let radius = Math.sqrt(width * height) * 0.008;

    ctx.beginPath();
    if (!highlighted) {
      ctx.strokeStyle = "#000";
      ctx.fillStyle = prompt[0] == 1 ? "rgba(0, 255, 255, 0.7)" : "rgba(255, 192, 203, 0.7)";
    } else {
      ctx.strokeStyle = "#F00";
      ctx.fillStyle = prompt[0] == 1 ? "rgba(60, 255, 255, 0.9)" : "rgba(255, 222, 260, 0.9)";
    }
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
  }

  function draw_box_prompt(prompt: Array<number>, highlighted: boolean = false) {
    if (!ctx) return;
    let scale_x = width / natural_width;
    let scale_y = height / natural_height;
    let x1 = prompt[1] * scale_x;
    let y1 = prompt[2] * scale_y;
    let x2 = prompt[3] * scale_x;
    let y2 = prompt[4] * scale_y;

    ctx.beginPath();
    if (!highlighted) {
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    } else {
      ctx.strokeStyle = "#F00";
      ctx.fillStyle = "rgba(60, 0, 0, 0.3)";
    }
    ctx.rect(x1, y1, x2 - x1, y2 - y1);
    ctx.fill();
    ctx.stroke();
  }


  function does_box_contains_prompt(box: Array<number>, prompt: Array<number>): boolean {
    let x1 = prompt[1];
    let y1 = prompt[2];
    let x2 = prompt[3];
    let y2 = prompt[4];
    let typecode = prompt[0];

    let box_x1 = box[0];
    let box_y1 = box[1];
    let box_x2 = box[2];
    let box_y2 = box[3];

    if (typecode == 0 || typecode == 1) {
      if (x1 >= box_x1 && y1 >= box_y1 && x1 <= box_x2 && y1 <= box_y2) {
        return true;
      }
    } else if (typecode == 2) {
      if (x1 >= box_x1 && y1 >= box_y1 && x2 <= box_x2 && y2 <= box_y2) {
        return true;
      }
    }
    return false;
  }


  function draw_prompts(prompts: Array<Array<number>>, highlight_box: Array<number> | null = null) {
    if (!ctx) return;
    prompts.forEach((prompt: Array<number>, index: number) => {
      let typecode = prompt[0];
      let highlighted = (highlight_box !== null && does_box_contains_prompt(highlight_box, prompt));

      if (typecode == 0 || typecode == 1) {
        draw_point_prompt(prompt, highlighted);
      } else if (typecode == 2) {
        draw_box_prompt(prompt, highlighted);
      }
    });
  }


  function draw_help() {
    if (!ctx) return;

    let white = "rgba(255, 255, 255, 1.0)";
    let green = "rgba(0, 255, 0, 1.0)";
    let red = "rgba(255, 0, 0, 1.0)";

    let lines = [
      ["[A] add mode.", (mode == "add" ? green : white)],
      ["[D] delete mode.", (mode == "delete" ? red: white)],
      ["click: (+)pt,  shift+click: (-)pt,  drag: box", white],
    ];

    ctx.font = "15px Arial";
    let max_width = lines.map(line => ctx!.measureText(line[0]).width).reduce((a, b) => Math.max(a, b), 0);

    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.0)";
    ctx.rect(10, 10, max_width + 45, lines.length * 20 + 15);
    ctx.fill();


    let y = 30;
    let dy = 20;

    lines.forEach(line => {
      ctx!.strokeStyle = "rgba(0, 0, 0, 1.0) 3px solid";
      ctx!.fillStyle = line[1];
      ctx!.fillText(line[0], 25, y);
      ctx!.strokeText(line[0], 25, y);
      y += dy;
    });
  }


</script>

<div class="wrap" bind:this={canvas_container}>
  <canvas
    bind:this={canvas}
    on:mousedown={handle_draw_start}
    on:mousemove={handle_draw_move}
    on:mouseout={handle_draw_move}
    on:mouseup={handle_draw_end}
    on:touchstart={handle_draw_start}
    on:touchmove={handle_draw_move}
    on:touchend={handle_draw_end}
    on:touchcancel={handle_draw_end}
    on:keydown={handle_keydown}
    on:blur={handle_draw_end}
    on:click|stopPropagation
  />
  <div class="slot_wrap" bind:this={slot_container}>
    <slot />
  </div>
</div>

<style>
  canvas {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: var(--size-full);
    height: var(--size-full);
    z-index: 2;
  }

  .slot_wrap {
    width: var(--size-full);
    height: var(--size-full);
    z-index: -20;
  }

  .wrap {
    position: relative;
    width: var(--size-full);
    height: var(--size-full);
    touch-action: none;
  }
</style>
