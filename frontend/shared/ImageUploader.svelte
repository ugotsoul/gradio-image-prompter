<script lang="ts">
	import { createEventDispatcher, tick } from "svelte";
	import { BlockLabel, IconButtonWrapper, IconButton } from "@gradio/atoms";
	import { Clear, Erase, Image as ImageIcon } from "@gradio/icons";
	import { FullscreenButton } from "@gradio/atoms";
	import {
		type SelectData,
		type I18nFormatter,
		type ValueData
	} from "@gradio/utils";

	import { Upload } from "@gradio/upload";
	import { Client, FileData } from "@gradio/client";
	import { SelectSource } from "@gradio/atoms";
	import Image from "./Image.svelte";
	import BoxDrawer from "./BoxDrawer.svelte";

	export let value: null | FileData = null;
  	export let points: null | number[][5];
	export let label: string | undefined = undefined;
	export let show_label: boolean;
	export let upload: Client["upload"];
	export let stream_handler: Client["stream"];

	export let use_boxes = true;
	export let use_points = false;

	type source_type = "upload" | "webcam" | "clipboard" | "microphone" | null;

	export let sources: source_type[] = ["upload", "clipboard"];
	export let streaming = false;
	export let pending = false;
	export let selectable = false;
	export let root: string;
	export let i18n: I18nFormatter;
	export let max_file_size: number | null = null;
	export let show_fullscreen_button = true;

	let upload_input: Upload;
	export let uploading = false;
	export let active_source: source_type = null;


	function handle_image_load(event: Event) {
		const element = event.currentTarget as HTMLImageElement;
		box_drawer.width = element.width;
		box_drawer.height = element.height;
		box_drawer.natural_width = element.naturalWidth;
		box_drawer.natural_height = element.naturalHeight;
		box_drawer.resize_canvas();
	}

	function handle_prompt_change({ detail }: { detail: number[][5] }) {
		points = detail;
		dispatch("points_change", detail);
	}

	async function handle_upload({
		detail
	}: CustomEvent<FileData>): Promise<void> {
		if (!streaming) {
			if (detail.path?.toLowerCase().endsWith(".svg") && detail.url) {
				const response = await fetch(detail.url);
				const svgContent = await response.text();
				value = {
					...detail,
					url: `data:image/svg+xml,${encodeURIComponent(svgContent)}`
				};
			} else {
				value = detail;
			}
			dispatch("upload", detail);
		}
	}

	function handle_clear(): void {
		value = null;
		dispatch("clear");
		dispatch("change", null);
	}

	async function handle_save(
		img_blob: Blob | any,
		event: "change" | "upload"
	): Promise<void> {
		pending = true;
		const f = await upload_input.load_files([
			new File([img_blob], `image/${streaming ? "jpeg" : "png"}`)
		]);

		if (event === "change" || event === "upload") {
			value = f?.[0] || null;
			await tick();
			dispatch("change");
		}
		pending = false;
	}

	$: active_streaming = streaming && active_source === "webcam";
	$: if (uploading && !active_streaming) value = null;

	const dispatch = createEventDispatcher<{
		change?: never;
		stream: ValueData;
		clear?: never;
		drag: boolean;
		upload: FileData;
		select: SelectData;
		end_stream: never;
		points_change: number[][5];
	}>();

  	let box_drawer: BoxDrawer;

	export let dragging = false;

	$: dispatch("drag", dragging);

	$: if (!active_source && sources) {
		active_source = sources[0];
	}

	async function handle_select_source(
		source: (typeof sources)[number]
	): Promise<void> {
		switch (source) {
			case "clipboard":
				upload_input.paste_clipboard();
				break;
			default:
				break;
		}
	}

	let image_container: HTMLElement;
</script>

<BlockLabel {show_label} Icon={ImageIcon} label={label || "Image"} />

<div data-testid="image" class="image-container" bind:this={image_container}>
	<IconButtonWrapper style="z-index: 2;">
		{#if value?.url && !active_streaming}
			{#if show_fullscreen_button}
				<FullscreenButton container={image_container} />
			{/if}

      <IconButton
        Icon={Erase}
        label="Remove All boxes"
        on:click={(event) => {
          box_drawer.clear();
					event.stopPropagation();
        }}
      />

      <IconButton
        Icon={Clear}
        label="Remove Image"
        on:click={(event) => {
          value = null;
          dispatch("clear");
					event.stopPropagation();
        }}
      />
    {/if}
	</IconButtonWrapper>
	<div
		class="upload-container"
		class:reduced-height={sources.length > 1}
		style:width={value ? "auto" : "100%"}
	>
		<Upload
			hidden={value !== null}
			bind:this={upload_input}
			bind:uploading
			bind:dragging
			filetype={active_source === "clipboard" ? "clipboard" : "image/*"}
			on:load={handle_upload}
			on:error
			{root}
			{max_file_size}
			disable_click={!sources.includes("upload") || value !== null}
			{ upload }
			{ stream_handler }
			aria_label={i18n("image.drop_to_upload")}
		>
			{#if value === null}
				<slot />
			{/if}
		</Upload>
		{#if value !== null && !streaming}
			<!-- svelte-ignore a11y-click-events-have-key-events-->
			<div class:selectable class="image-frame">
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <BoxDrawer 
			bind:this={box_drawer} 
			on:change={handle_prompt_change}
			use_boxes={use_boxes}
			use_points={use_points}
		>
          <img src={value.url} alt={value.alt_text} on:load={handle_image_load} />
        </BoxDrawer>
			</div>
		{/if}
	</div>
	{#if sources.length > 1 || sources.includes("clipboard")}
		<SelectSource
			{sources}
			bind:active_source
			{handle_clear}
			handle_select={handle_select_source}
		/>
	{/if}
</div>

<style>
	.image-frame :global(img) {
		width: var(--size-full);
		height: var(--size-full);
		object-fit: fill;
	}

	img {
		width: var(--size-full);
		height: var(--size-full);
	}


	.image-frame {
		object-fit: cover;
		width: 100%;
		height: 100%;
	}

	.upload-container {
		display: flex;
		align-items: center;
		justify-content: center;

		height: 100%;
		flex-shrink: 1;
		max-height: 100%;
	}

	.reduced-height {
		height: calc(100% - var(--size-10));
	}

	.image-container {
		display: flex;
		height: 100%;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		max-height: 100%;
	}

	.selectable {
		cursor: crosshair;
	}
</style>
