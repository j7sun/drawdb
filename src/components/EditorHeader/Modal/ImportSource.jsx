import { Upload, Checkbox, Banner, Tabs, TabPane } from "@douyinfe/semi-ui";
import { STATUS } from "../../../data/constants";
import { useTranslation } from "react-i18next";
import CodeEditor from "../../CodeEditor";

export default function ImportSource({
  importData,
  setImportData,
  error,
  setError,
}) {
  const { t } = useTranslation();

  return (
    <div>
      <Tabs>
        <TabPane tab={t("insert_sql")} itemKey="text-import">
          <CodeEditor
            height={224}
            language="sql"
            onChange={(value) => {
              setImportData((prev) => ({ ...prev, src: value }));
              setError({
                type: STATUS.NONE,
                message: "",
              });
            }}
          />
        </TabPane>
        <TabPane tab={t("upload_file")} itemKey="file-import">
          <Upload
            action="#"
            beforeUpload={({ file, fileList }) => {
              const f = fileList[0].fileInstance;
              if (!f) {
                return;
              }
              const reader = new FileReader();
              reader.onload = async (e) => {
                const buffer = e.target.result;
                const uint8 = new Uint8Array(buffer);
                // Detect UTF-16 BOM (SSMS saves .sql files as UTF-16 LE by default)
                let encoding = "UTF-8";
                if (uint8[0] === 0xff && uint8[1] === 0xfe) encoding = "UTF-16LE";
                else if (uint8[0] === 0xfe && uint8[1] === 0xff) encoding = "UTF-16BE";
                const text = new TextDecoder(encoding).decode(buffer);
                setImportData((prev) => ({ ...prev, src: text }));
              };
              reader.readAsArrayBuffer(f);

              return {
                autoRemove: false,
                fileInstance: file.fileInstance,
                status: "success",
                shouldUpload: false,
              };
            }}
            draggable={true}
            dragMainText={t("drag_and_drop_files")}
            dragSubText={t("upload_sql_to_generate_diagrams")}
            accept=".sql"
            onRemove={() => {
              setError({
                type: STATUS.NONE,
                message: "",
              });
              setImportData((prev) => ({ ...prev, src: "" }));
            }}
            onFileChange={() =>
              setError({
                type: STATUS.NONE,
                message: "",
              })
            }
            limit={1}
          />
        </TabPane>
      </Tabs>

      <div className="mt-2">
        <Checkbox
          aria-label="overwrite checkbox"
          checked={importData.overwrite}
          onChange={(e) =>
            setImportData((prev) => ({
              ...prev,
              overwrite: e.target.checked,
            }))
          }
        >
          {t("overwrite_existing_diagram")}
        </Checkbox>
        <div className="mt-2">
          {error.type === STATUS.ERROR ? (
            <Banner
              type="danger"
              fullMode={false}
              description={<div>{error.message}</div>}
            />
          ) : error.type === STATUS.OK ? (
            <Banner
              type="info"
              fullMode={false}
              description={<div>{error.message}</div>}
            />
          ) : (
            error.type === STATUS.WARNING && (
              <Banner
                type="warning"
                fullMode={false}
                description={<div>{error.message}</div>}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
