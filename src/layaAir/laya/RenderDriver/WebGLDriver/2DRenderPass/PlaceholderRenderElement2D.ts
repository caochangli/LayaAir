import { IRenderElement2D } from "../../DriverDesign/2DRenderPass/IRenderElement2D";
import { IRenderContext2D } from "../../DriverDesign/2DRenderPass/IRenderContext2D";
import { WebRender2DPass } from "../../RenderModuleData/WebModuleData/2D/WebRender2DPass";
import { WebRenderStruct2D } from "../../RenderModuleData/WebModuleData/2D/WebRenderStruct2D";

/**
 * @internal 独立 pass 子树根在父 pass 中的占位渲染元素。
 * geometry 为 null，跳过正常 draw 路径；_render 改为内联触发所绑定的无 RT 子pass，
 * 由子pass 直接画到当前 render target（不切 RT）。z 序由其在父 pass _renderElements 中的位置决定。
 */
export class PlaceholderRenderElement2D implements IRenderElement2D {
    type: number = 0;
    geometry: any = null;
    materialShaderData: any = null;
    value2DShaderData: any = null;
    globalShaderData: any = null;
    subShader: any = null;
    renderStateIsBySprite: boolean = false;
    nodeCommonMap: Array<string> = null;
    owner: WebRenderStruct2D;
    _index: number = 0;

    private _subPass: WebRender2DPass;

    constructor(subPass: WebRender2DPass, owner: WebRenderStruct2D) {
        this._subPass = subPass;
        this.owner = owner;
    }

    /** 不编译 shader、不画 geometry */
    _prepare(context: IRenderContext2D): void {
        // no-op：占位 element 无 shader/geometry
    }

    /** 内联触发所绑定的独立子pass，直接画到当前 render target */
    _render(context: IRenderContext2D): void {
        if (this._subPass) {
            this._subPass.inlineRender(context);
        }
    }

    destroy(): void {
        this._subPass = null;
        this.owner = null;
    }
}
