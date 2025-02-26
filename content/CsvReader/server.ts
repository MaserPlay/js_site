import { Content } from "../../server/content_class";

export default class extends Content{
    createdAt(){
        return new Date(2024, 11, 6)
    }
    lastModification(){
        return new Date(2024, 12, 8)
    }
}