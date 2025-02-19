  import { FileData } from "@gradio/client";

export const get_coordinates_of_clicked_image = (
	evt: MouseEvent
): [number, number] | null => {
	let image = evt.currentTarget as HTMLImageElement;

	const imageRect = image.getBoundingClientRect();
	const xScale = image.naturalWidth / imageRect.width;
	const yScale = image.naturalHeight / imageRect.height;
	if (xScale > yScale) {
		const displayed_height = image.naturalHeight / xScale;
		const y_offset = (imageRect.height - displayed_height) / 2;
		var x = Math.round((evt.clientX - imageRect.left) * xScale);
		var y = Math.round((evt.clientY - imageRect.top - y_offset) * xScale);
	} else {
		const displayed_width = image.naturalWidth / yScale;
		const x_offset = (imageRect.width - displayed_width) / 2;
		var x = Math.round((evt.clientX - imageRect.left - x_offset) * yScale);
		var y = Math.round((evt.clientY - imageRect.top) * yScale);
	}
	if (x < 0 || x >= image.naturalWidth || y < 0 || y >= image.naturalHeight) {
		return null;
	}
	return [x, y];
};

// Copied from
// https://github.com/gradio-app/gradio/blob/e16b4abc375cd1f246b7a1095407cef4fca1d15d/client/js/src/upload.ts#L21
export function normalise_file(
	file: FileData | null,
	server_url: string, // root: string,
	proxy_url: string | null // root_url: string | null
): FileData | null {
	if (file == null) {
		return null;
	}

	if (file.is_stream) {
		if (proxy_url == null) {
			return new FileData({
				...file,
				url: server_url + "/stream/" + file.path
			});
		}
		return new FileData({
			...file,
			url: "/proxy=" + proxy_url + "stream/" + file.path
		});
	}

	return new FileData({
		...file,
		url: get_fetchable_url_or_file(file.path, server_url, proxy_url)
	});
}


function is_url(str: string): boolean {
	try {
		const url = new URL(str);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}


export function get_fetchable_url_or_file(
	path: string | null,
	server_url: string,
	proxy_url: string | null
): string {
	if (path == null) {
		return proxy_url ? `/proxy=${proxy_url}file=` : `${server_url}/file=`;
	}
	if (is_url(path)) {
		return path;
	}
	return proxy_url
		? `/proxy=${proxy_url}file=${path}`
		: `${server_url}/file=${path}`;
}
