using UnityEngine;
using System.Collections;
using UnityEditor;
using System.IO;
using System.Collections.Generic;
using System.Diagnostics;

/// <summary>
/// 用于生成新工程的必须文件夹以及导入VSCode
/// </summary>
public class MakeNecessaryFolder : Editor {


	#region Make Necessary Folders

	[MenuItem("Utils/Make Necessary Folders %#r")]
	public static void MakeFolders () {
        List<string> paths = FilterFolderPathList(GetNecessaryFolderPathList());
		for (int i = 0; i < paths.Count; i++)
		{
			Directory.CreateDirectory(paths[i]);
		}

        AssetDatabase.Refresh();
    }

	private static List<string> GetNecessaryFolderPathList () {
        List<string> list = new List<string>();
        list.Add(Application.dataPath + Path.DirectorySeparatorChar + "Editor");
        list.Add(Application.dataPath + Path.DirectorySeparatorChar + "Scenes");
        list.Add(Application.dataPath + Path.DirectorySeparatorChar + "Scripts");

        return list;
    }

    private static List<string> FilterFolderPathList(List<string> list)
    {
		for (int i = list.Count - 1; i >= 0; i--)
		{
			if (AssetDatabase.IsValidFolder (list[i])) {
                list.RemoveAt(i);
            }
		}

        return list;
    }

	#endregion


	#region Import VSCode

	[MenuItem ("Utils/Import VSCode %#v")]
	public static void ImportVSCode () {
		string path = Application.dataPath + Path.DirectorySeparatorChar + "VSCode";
        string originalPath = "/Users/oyyming/DevTools/unity/ProjectNecessary/VSCode/";
        if (AssetDatabase.IsValidFolder(path))
            return;
        FileUtil.CopyFileOrDirectory(originalPath, path);
        AssetDatabase.Refresh();
    }

	#endregion


	#region Open File In Finder

	[MenuItem ("Utils/Open In Finder  %#f")]
	public static void OpenInFinder () {
		if (Selection.activeObject == null) {
			Process.Start(Application.dataPath);
            return;
        }

        string path = AssetDatabase.GetAssetPath(Selection.activeObject.GetInstanceID());
		if (!string.IsNullOrEmpty (path)) {
            string filePath = Application.dataPath + Path.DirectorySeparatorChar + path.Replace("Assets/", "");
			if (Directory.Exists (filePath))
				Process.Start(filePath);
			else
            	Process.Start(Path.GetDirectoryName(filePath));
        }
    }

	#endregion

}
