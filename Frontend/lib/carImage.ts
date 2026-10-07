export function createCarImage(
  make: string,
  model: string,
  year: string
) {
  const url = new URL(
    "https://cdn.imagin.studio/getImage"
  );

  url.searchParams.set(
    "customer",
    "hrjavascript-mastery"
  );

  url.searchParams.set("make", make);

  url.searchParams.set(
    "modelFamily",
    model.split(" ")[0]
  );

  if (year && year !== "N/A") {
    url.searchParams.set("modelYear", year);
  }

  url.searchParams.set("angle", "23");
  url.searchParams.set(
    "zoomtype",
    "fullscreen"
  );

  url.searchParams.set("width", "400");

  return url.toString();
}