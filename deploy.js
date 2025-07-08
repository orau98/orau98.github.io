import ghpages from 'gh-pages';

ghpages.publish('dist', { 
  dotfiles: true,
  src: '**/*', // distディレクトリ内のすべてのファイルを対象
  dest: '.', // gh-pagesブランチのルートにデプロイ
  branch: 'gh-pages', // gh-pagesブランチにデプロイ
  clean: true, // デプロイ前にgh-pagesブランチをクリーンアップ
  nojekyll: true, // .nojekyll ファイルを作成してJekyllの処理を無効化
  add: true, // 既存のファイルを上書きし、新しいファイルを追加
  message: 'Deploying updates', // デプロイ時のコミットメッセージ
  history: false // Gitの履歴を考慮せず、常に新しいコミットとしてプッシュ
}, function(err) {
  if (err) {
    console.error('Deployment error:', err);
  } else {
    console.log('Deployment complete!');
  }
});
