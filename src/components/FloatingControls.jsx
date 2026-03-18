import { Divider, Tooltip } from "@douyinfe/semi-ui";
import { useTransform, useLayout, useDiagram, useSettings } from "../hooks";
import { exitFullscreen } from "../utils/fullscreen";
import { useTranslation } from "react-i18next";
import { performAutoLayout } from "../utils/autoLayout";

export default function FloatingControls() {
  const { transform, setTransform } = useTransform();
  const { setLayout } = useLayout();
  const { t } = useTranslation();
  const { tables, relationships, updateTable } = useDiagram();
  const { settings } = useSettings();

  const handleAutoLayout = () => {
    const layouted = performAutoLayout(tables, relationships, settings);
    Object.keys(layouted).forEach((tableId) => {
      if (layouted[tableId]) {
        updateTable(tableId, layouted[tableId]);
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Tooltip content={t("auto_layout") || "Auto Layout"}>
        <button
          className="px-3 py-2 rounded-lg popover-theme"
          onClick={handleAutoLayout}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
        </button>
      </Tooltip>
      <div className="popover-theme flex rounded-lg items-center">
        <button
          className="px-3 py-2"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              zoom: prev.zoom / 1.2,
            }))
          }
        >
          <i className="bi bi-dash-lg" />
        </button>
        <Divider align="center" layout="vertical" />
        <div className="px-3 py-2">{parseInt(transform.zoom * 100)}%</div>
        <Divider align="center" layout="vertical" />
        <button
          className="px-3 py-2"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              zoom: prev.zoom * 1.2,
            }))
          }
        >
          <i className="bi bi-plus-lg" />
        </button>
      </div>
      <Tooltip content={t("exit")}>
        <button
          className="px-3 py-2 rounded-lg popover-theme"
          onClick={() => {
            setLayout((prev) => ({
              ...prev,
              sidebar: true,
              toolbar: true,
              header: true,
            }));
            exitFullscreen();
          }}
        >
          <i className="bi bi-fullscreen-exit" />
        </button>
      </Tooltip>
    </div>
  );
}
