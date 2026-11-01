// Raster artwork used by the prototype. Originals live in design/source-images/;
// to swap an image, export new WebP sizes with the same names (see DESIGN_NOTES.md).
import heroSmall from '../assets/images/welcome-hero-handlebar-pov-640.webp';
import heroLarge from '../assets/images/welcome-hero-handlebar-pov-1024.webp';
import rideSmall from '../assets/images/ride-scenic-bike-lane-640.webp';
import rideLarge from '../assets/images/ride-scenic-bike-lane-1024.webp';
import vehicleSmall from '../assets/images/vehicle-white-electric-scooter-320.webp';
import vehicleLarge from '../assets/images/vehicle-white-electric-scooter-720.webp';

export interface ImageAsset {
  src: string;
  srcSet: string;
  /** Intrinsic size, so the browser can reserve space before the file loads. */
  width: number;
  height: number;
  alt: string;
}

export const WELCOME_HERO: ImageAsset = {
  src: heroLarge,
  srcSet: `${heroSmall} 640w, ${heroLarge} 1024w`,
  width: 1024,
  height: 1536,
  alt: 'Illustration: a rider’s view over kick-scooter handlebars, with a phone mounted in the middle, looking down a sunny tree-lined road.',
};

export const RIDE_SCENE: ImageAsset = {
  src: rideLarge,
  srcSet: `${rideSmall} 640w, ${rideLarge} 1024w`,
  width: 1024,
  height: 1536,
  alt: 'Static illustration of a green bike lane running through a leafy city park. Decorative only — not your route.',
};

export const VEHICLE: ImageAsset = {
  src: vehicleLarge,
  srcSet: `${vehicleSmall} 320w, ${vehicleLarge} 720w`,
  width: 720,
  height: 720,
  alt: 'White electric scooter with a black seat',
};
