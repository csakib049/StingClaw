import { getTelegramOwnerId } from "../../storage/repository";

export const isOwner = (id: number) => String(id) === getTelegramOwnerId();
